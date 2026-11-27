---
title: "Tool Calls: How Language Models Act on the World"
description: "A technical explainer on tool calling \u2014 what it is, why it enables agents, how the mechanism works, and the engineering trade-offs you'll face in production."
date: "2026-11-27"
format: "explainer"
concept: "tool calls"
tldr: ["Tool calling lets LLMs invoke external functions by emitting structured JSON that a host system executes, returning results back to the model.", "It solves the knowledge-cutoff and hallucination problems by grounding models in live data and real actions.", "Multi-step tool use remains hard: open-source models lag on chained calls, but execution-grounded synthesis and critical-state RL close the gap.", "Direct tool calls consume context; code-execution approaches (MCP) scale better for complex workflows.", "Evaluating tool use requires ablation studies, distribution analysis, and red-teaming for cross-service safety."]
references: ["S1: Databricks Blog \u2014 https://www.databricks.com/blog/what-is-tool-calling", "S2: arXiv \u2014 Multi-Step Tool-Calling over Korean Open Public APIs \u2014 https://arxiv.org/abs/2609.05395v1", "S3: arXiv \u2014 Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use \u2014 https://arxiv.org/abs/2609.24985v1", "S4: arXiv \u2014 PalmClaw: A Native On-Device Agent Framework for Mobile Phones \u2014 https://arxiv.org/abs/2607.13027v1", "S5: InfoQ Architecture \u2014 Opening the Black Box: Critical Explainability for AI Agent Tool Selection with Kiji Inspector \u2014 https://www.infoq.com/presentations/explainable-ai-llm-agent-decisions/", "S6: arXiv \u2014 AISPA: User-Centric System Prompt Auditing for Large Language Model Applications \u2014 https://arxiv.org/abs/2607.28617v1", "S7: AI Engineering (Chip Huyen) \u2014 AI Engineering by Chip Huyen \u2014 part 279", "S8: Anthropic Engineering \u2014 Code execution with MCP: Building more efficient agents \u2014 https://www.anthropic.com/engineering/code-execution-with-mcp", "S10: arXiv \u2014 X-AgentRed: Red-Teaming Personal Agents in Evolving Multi-Service Ecosystems \u2014 https://arxiv.org/abs/2610.13886v1", "S14: Hacker News \u2014 Strands Decider 2B: a small, open-source, decision model \u2014 https://strandsagents.com/blog/introducing-strands-decider/"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-11-27-tool-calls-how-language-models-act-on-the-world.json"
---

## What It Is

Tool calling — also called function calling — is the capability of a large language model (LLM) to request execution of an external function, API, or program by emitting a structured payload (typically JSON) that conforms to a predefined schema. The host system parses that payload, runs the named function with the provided arguments, and feeds the result back into the model’s context as a new message. The model then continues reasoning or produces a final answer.

Think of it as giving the model a set of typed levers it can pull. Instead of hallucinating a SQL query, the model calls `run_sql(query: string)` and receives actual rows. Instead of guessing the weather, it calls `get_forecast(lat: float, lon: float)` and gets a structured response. The model does not execute code itself; it only *proposes* calls. The runtime — your application server, an agent framework, or an on-device loop — is the actuator.

The concept was popularized by OpenAI’s function-calling API in 2023 and is now standard across major model providers. Databricks describes it as "the ability of an AI model to interact with external tools, APIs, and data sources" [S1].

## Why It Matters

Without tool access, an LLM is a closed-book exam taker: it can only draw on parametric knowledge frozen at training cutoff, and it cannot *do* anything — no database writes, no API requests, no file operations. Tool calling changes that in three ways:

1. **Live grounding.** The model retrieves current facts (stock prices, documentation, user-specific data) instead of relying on stale weights.
2. **Action.** It can mutate state: send email, provision infrastructure, update a CRM.
3. **Composition.** Chaining multiple tools lets the model solve multi-step problems — e.g., search → filter → calculate → format → send.

This is the foundation of *agents*: systems that perceive, decide, and act in a loop. As Anthropic notes, agents "scale better by writing code to call tools instead" of making many direct tool calls [S8], but the primitive remains the same — structured invocation with explicit arguments and results.

## How It Works: A Concrete Walkthrough

Imagine a user asks: "What’s the USD value of 5 ETH right now?"

1. **Tool definitions in context.** The system prompt includes a JSON Schema for `get_crypto_price(symbol: string) -> {price_usd: number, timestamp: string}`.
2. **Model decides to call.** The assistant message contains a special `tool_calls` field (OpenAI format) or a tagged block (Anthropic format) with `name: "get_crypto_price"` and `arguments: {"symbol": "ETH"}`.
3. **Runtime executes.** Your backend parses the call, hits a market-data API, and returns `{"price_usd": 3421.50, "timestamp": "2025-01-15T12:34:56Z"}` as a `tool` role message.
4. **Model responds.** The assistant now answers: "5 ETH ≈ $17,107.50 (as of 12:34 UTC)."

Key components:
- **Schema registry.** Each tool has a name, description, and JSON Schema for arguments. Descriptions matter — they are the model’s documentation.
- **Call format.** Varies by provider (OpenAI `tool_calls`, Anthropic `tool_use`, Mistral `tool_calls`). Frameworks normalize this.
- **Execution sandbox.** The runtime must validate arguments, enforce timeouts, handle auth, and capture errors as structured results.
- **Result injection.** Tool outputs re-enter the conversation, counted against the context window.

## Key Techniques and Variants

### Single vs. Multi-Step Tool Calling
Most benchmarks test single calls. Real workflows chain many. The KOPA-Bench benchmark (145 real-world tasks over live Korean government APIs) shows open-source models struggle with multi-step sequences [S2]. The EDGE synthesis method builds a graph of verified tool-to-tool data flows by *actually executing* candidate edges against live APIs, then traverses only successful links to generate training trajectories. Fine-tuning a 9B model on this data nearly matches an untuned 27B model from the same family, with gains transferring to the Berkeley Function Calling Leaderboard (BFCL) [S2].

### Training for Tool Use
Critical-State RL diagnoses which model calls in a multi-turn trajectory are actually *trainable* — i.e., where reward variation reflects the current action, not downstream noise. On BFCL v4 missing-function tasks, training only the selected responses improved performance by ~14 percentage points; training alternative states left performance flat or worse [S3]. For missing-argument tasks, the method selects the turn *before* the argument is supplied. This avoids wasting compute on unlearnable states.

### Direct Calls vs. Code Execution
Direct tool calls stuff every schema and result into the context window. Anthropic’s MCP (Model Context Protocol) approach lets the model write *code* that calls tools, then executes that code in a sandbox [S8]. One code block can loop, branch, and batch calls — far more context-efficient for complex workflows. MXC provides a sandboxed code execution environment for this pattern [S13].

### On-Device Tool Calling
PalmClaw runs the entire agent loop — session, memory, skills, tools — natively on a phone. It exposes device capabilities (contacts, calendar, sensors) as *device tools* with explicit arguments, structured results, and defined execution boundaries. This yields an 11.5% relative improvement in task success and a 94.9% reduction in completion time over the strongest GUI-based baseline [S4].

### Explainability and Decision Models
Why did the model pick *that* tool? Kiji Inspector applies Sparse Autoencoders (SAEs) directly to decision tokens, using causal ablation and patched vLLM engines to surface the features driving tool selection — moving beyond post-hoc chain-of-thought narratives [S5]. Strands Decider 2B is a small (2B), open-source model specialized for the *routing* decision: which tool (or none) given the context [S14].

### System Prompt Governance
System prompts configure tool-use behavior (e.g., "never call `delete_user` without confirmation"). AISPA audited 3,249 instructions across 88 commercial products: 98.9% contain at least one protective instruction, but only 24% cover all eight safety dimensions [S6]. Prompt length and protectiveness have grown steadily.

## Applications

- **Public-sector agents.** Chaining live government APIs for permit lookup, tax filing, benefit enrollment — exactly the KOPA-Bench domain [S2].
- **Mobile automation.** On-device agents that read notifications, schedule meetings, control IoT — PalmClaw’s domain [S4].
- **Code-generation agents.** Writing and executing scripts to analyze data, refactor codebases, or drive CI — the MCP use case [S8].
- **Safety red-teaming.** X-AgentRed builds a dependency graph of tool effects and preconditions, samples cross-service call paths, and uses execution feedback to evolve harmful scenarios — e.g., a benign request that accidentally leaks data across services [S10].
- **Analytics and BI.** Text-to-SQL, dashboard generation, report scheduling — classic single-call or short-chain workloads.

## Trade-offs and Limitations

| Dimension | Reality |
|-----------|---------|
| **Context consumption** | Every tool definition and result eats tokens. Long schemas or verbose outputs shrink the window for reasoning [S8]. |
| **Latency & reliability** | Each call is a network hop. Timeouts, rate limits, and partial failures are your problem. |
| **Model competence** | Models differ in tool preference and accuracy. GPT-4 selects a wider tool set; ChatGPT favors image captioning. Ablation studies reveal tools the model *can’t* learn — drop or redesign them [S7]. |
| **Evaluation gaps** | Static benchmarks (BFCL) don’t capture live API drift, auth flows, or multi-service composition. Red-teaming [S10] and execution-grounded synthesis [S2] help but are not turnkey. |
| **Security surface** | Tool calls are an injection vector. Argument validation, least-privilege credentials, and audit logging are mandatory. |
| **On-device constraints** | Mobile NPU memory and thermal limits cap model size and call concurrency [S4]. |

**When not to use tool calls:**
- The task is pure reasoning on provided context (no external data/action needed).
- Latency budget is sub-100ms and the tool is remote.
- The model consistently fails the call schema despite prompt engineering and few-shot — swap the tool or the model [S7].

## Further Reading

- Databricks: "What is Tool Calling?" — accessible overview of the API pattern [S1]
- KOPA-Bench & EDGE (arXiv:2609.05395) — multi-step benchmark and execution-grounded data synthesis [S2]
- Critical-State RL (arXiv:2609.24985) — diagnosing trainable states in multi-turn tool use [S3]
- PalmClaw (arXiv:2607.13027) — on-device agent framework with device tools [S4]
- Kiji Inspector (InfoQ) — SAE-based explainability for tool selection [S5]
- AISPA (arXiv:2607.28617) — system prompt auditing taxonomy and commercial audit [S6]
- AI Engineering (Chip Huyen) — tool ablation, distribution analysis, model preferences [S7]
- Anthropic Engineering: Code Execution with MCP — scaling agents via code instead of direct calls [S8]
- X-AgentRed (arXiv:2610.13886) — graph-based red-teaming for cross-service tool paths [S10]
- Strands Decider 2B — lightweight routing model for tool selection [S14]

## References

- S1: Databricks Blog — https://www.databricks.com/blog/what-is-tool-calling
- S2: arXiv — Multi-Step Tool-Calling over Korean Open Public APIs — https://arxiv.org/abs/2609.05395v1
- S3: arXiv — Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use — https://arxiv.org/abs/2609.24985v1
- S4: arXiv — PalmClaw: A Native On-Device Agent Framework for Mobile Phones — https://arxiv.org/abs/2607.13027v1
- S5: InfoQ Architecture — Opening the Black Box: Critical Explainability for AI Agent Tool Selection with Kiji Inspector — https://www.infoq.com/presentations/explainable-ai-llm-agent-decisions/
- S6: arXiv — AISPA: User-Centric System Prompt Auditing for Large Language Model Applications — https://arxiv.org/abs/2607.28617v1
- S7: AI Engineering (Chip Huyen) — AI Engineering by Chip Huyen — part 279
- S8: Anthropic Engineering — Code execution with MCP: Building more efficient agents — https://www.anthropic.com/engineering/code-execution-with-mcp
- S10: arXiv — X-AgentRed: Red-Teaming Personal Agents in Evolving Multi-Service Ecosystems — https://arxiv.org/abs/2610.13886v1
- S14: Hacker News — Strands Decider 2B: a small, open-source, decision model — https://strandsagents.com/blog/introducing-strands-decider/
