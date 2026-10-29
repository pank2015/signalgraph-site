---
title: "Tool Calls: How LLMs Act in the World"
description: "A technical explainer on tool calling \u2014 the mechanism that turns language models into agents that invoke APIs, execute code, and control real systems."
date: "2026-10-29"
format: "explainer"
concept: "tool calls"
tldr: ["Tool calling lets an LLM emit structured function calls (name + JSON arguments) that a runtime executes, returning results back to the model.", "It transforms models from text generators into agents that can query live data, mutate state, and chain multi-step operations.", "Multi-step tool calling remains a key differentiator: open-source models lag proprietary ones on chained calls over live APIs.", "Direct tool calls consume context; code-as-actions (writing programs that call tools) scales better for complex workflows.", "Tool design, evaluation (BFCL, KOPA-Bench), and cross-service safety (red-teaming) are active engineering concerns."]
references: ["S1: Databricks Blog \u2014 https://www.databricks.com/blog/what-is-tool-calling", "S2: arXiv \u2014 Multi-Step Tool-Calling over Korean Open Public APIs (KOPA-Bench) \u2014 https://arxiv.org/abs/2609.05395v1", "S3: arXiv \u2014 Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use \u2014 https://arxiv.org/abs/2609.24985v1", "S4: arXiv \u2014 PalmClaw: A Native On-Device Agent Framework for Mobile Phones \u2014 https://arxiv.org/abs/2607.13027v1", "S6: AI Engineering by Chip Huyen \u2014 part 279 \u2014 pack://ai-engineering-by-chip-huyen", "S7: Anthropic Engineering \u2014 Code execution with MCP: Building more efficient agents \u2014 https://www.anthropic.com/engineering/code-execution-with-mcp", "S8: arXiv \u2014 X-AgentRed: Red-Teaming Personal Agents in Evolving Multi-Service Ecosystems \u2014 https://arxiv.org/abs/2610.13886v1", "S10: Hacker News \u2014 MXC - a sandboxed code execution system \u2014 https://github.com/microsoft/mxc", "S13: arXiv \u2014 Work Agents: Systems, Capabilities, and Optimization \u2014 https://arxiv.org/abs/2610.35845v1", "S14: Databricks Blog \u2014 Beyond dashboards: Introducing Decision Execution Platforms \u2014 https://www.databricks.com/blog/beyond-dashboards-introducing-decision-execution-platforms"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-10-29-tool-calls-how-llms-act-in-the-world.json"
---

## What It Is

Tool calling (also called function calling) is the ability of a large language model (LLM) to invoke external functions, APIs, or tools by emitting structured calls — typically a function name and a JSON argument payload — that an external runtime executes, returning results back into the model's context for further reasoning [S1].

Think of the LLM as a planner that can reach out to specialized "workers" — a calculator, a database query, a web search, a code interpreter — each with a defined interface. The model decides *what* to call and *with what arguments*; the runtime handles *how* to execute it. This distinction matters: the model never directly touches the network, filesystem, or device sensors. It only produces a data structure that the host system interprets.

## Why It Matters

Without tool calling, LLMs are confined to their training data and parametric knowledge. They cannot access real-time information, mutate state, or perform precise computations. Tool calling transforms a model from a text generator into an *agent* that can act in the world: query live APIs, execute code, control devices, and chain operations across services [S1][S13]. This is the foundation of the "agentic" paradigm where models plan, act, observe, and iterate.

The shift is practical. A model that can only *describe* how to book a flight is far less useful than one that actually calls the airline API, checks seat availability, and confirms the reservation. Tool calling bridges the gap between reasoning and execution.

## How It Works

The mechanism has three parts:

1. **Tool definitions** — JSON schemas (often OpenAPI or JSON Schema) describing each tool's name, description, parameters, and return type. These are injected into the model's context (system prompt or a dedicated tools block).
2. **Model invocation** — The model, prompted with the user request and tool definitions, emits a *tool call* — a structured object like `{"name": "get_weather", "arguments": {"city": "Seoul"}}` — instead of (or alongside) natural language.
3. **Execution loop** — The host runtime parses the call, invokes the actual function/API, captures the result (or error), and feeds it back as a *tool result* message. The model then continues, potentially making more calls or producing a final answer.

**Concrete example**: A user asks "What's the weather in Seoul and should I bring an umbrella?" The model sees a `get_weather` tool. It calls `get_weather({"city": "Seoul"})`. The runtime hits a weather API, returns `{"temp": 18, "precipitation": 0.8}`. The model reasons: "High precipitation probability, recommend umbrella" and answers.

**Key detail**: Direct tool calls consume context for each definition and result. Anthropic's MCP (Model Context Protocol) approach lets agents *write code* that calls tools, scaling better by batching operations and reducing context overhead [S7].

## Key Techniques and Variants

### Single-step vs. multi-step tool calling
Early tool use was often one call per turn. Modern agents chain multiple calls — e.g., search → fetch → calculate → respond. Multi-step is harder: open-source models consistently underperform proprietary ones on chained calls over live APIs [S2]. The KOPA-Bench benchmark (145 real-world tasks over Korean public APIs) measures this gap [S2].

### Data synthesis for multi-step training
EDGE (Execution-grounded Dynamic Graph) builds a graph of how tool outputs feed other tool inputs, keeps only links that succeed on live APIs, and traverses verified paths to synthesize executable multi-step trajectories. Fine-tuning a 9B model on EDGE data nearly matches an untuned 27B model from the same family, improving on both KOPA-Bench and BFCL [S2].

### Code-as-actions
Instead of emitting discrete tool calls, the model writes a program (e.g., Python) that invokes tools. This compresses many calls into one context window and enables control flow (loops, conditionals) [S7].

### On-device tool calling
PalmClaw exposes mobile capabilities (sensors, apps, settings) as *device tools* with explicit arguments, structured results, and defined execution boundaries, running the agent loop natively on the phone. This yields an 11.5% relative improvement in task success and a 94.9% reduction in completion time over the strongest baseline [S4].

### Critical-state RL for multi-turn tool use
Not all model calls in a trajectory are equally trainable. Critical-State RL uses nested sampling to separate action-dependent reward variation from continuation noise, identifying which states benefit from training. On BFCL v4, training at diagnostic-selected states improves missing-function task performance by ~14 percentage points, while training at alternative states leaves performance flat or worse [S3].

### Tool dependency graphs for safety
X-AgentRed constructs a directed graph of how one tool's effects satisfy another's preconditions, then samples recipes to red-team cross-service tool call paths, using execution feedback to diversify [S8].

## Applications

- **Government/public API automation**: Chaining calls across live government services (tax, transit, permits) under data-sovereignty constraints — the KOPA-Bench domain [S2].
- **Mobile device control**: PalmClaw lets agents toggle Wi-Fi, read notifications, send messages, and use apps via typed tool calls rather than brittle GUI tapping [S4].
- **Code execution environments**: Agents that write and run code in sandboxes (e.g., MCP, MXC [S10]) to analyze data, transform files, or drive browsers.
- **Enterprise workflows**: Decision Execution Platforms that combine models with tool harnesses to execute delegated work in stateful workspaces [S13][S14].
- **Cross-service personal agents**: Managing calendars, email, finance, and smart home devices through composed tool calls [S8].

## Trade-offs and Limitations

- **Context pressure**: Each tool definition and result consumes tokens. Long tool lists or verbose results squeeze the reasoning budget [S7].
- **Model capability variance**: Different models have different tool preferences and proficiency. GPT-4 selects a wider tool set than ChatGPT; ChatGPT favors image captioning, GPT-4 favors knowledge retrieval [S6]. Open-source models lag on multi-step calling [S2].
- **Tool design matters**: If a tool is too hard for the model to use (wrong abstraction, ambiguous schema), extensive prompting and even fine-tuning may not fix it — change the tool instead [S6]. Ablation studies reveal which tools actually contribute [S6].
- **Compositional risk**: Chaining tools across services can produce unintended harmful outcomes even from benign requests. Red-teaming must explore cross-service paths systematically [S8].
- **Evaluation gaps**: Benchmarks like BFCL and KOPA-Bench exist but may not cover all real-world distributions. Multi-turn credit assignment remains hard [S3].
- **Execution boundaries**: On mobile and sandboxed environments, defining clear execution boundaries (what the tool can/cannot do, rollback semantics) is critical for safety and debuggability [S4][S10].

## Further Reading

- Databricks: "What is Tool Calling?" — foundational definition and overview [S1]
- KOPA-Bench & EDGE: Multi-step tool-calling benchmark and synthesis method for live APIs [S2]
- Critical-State RL: Diagnosing trainable states in multi-turn tool use [S3]
- PalmClaw: On-device agent framework with device tools [S4]
- Anthropic Engineering: Code execution with MCP — scaling tool use via code [S7]
- X-AgentRed: Red-teaming cross-service tool call paths [S8]
- Chip Huyen, *AI Engineering*: Tool ablation, usage patterns, and model differences [S6]
- Work Agents: System-level perspective on agents as work execution systems [S13]

## References

- S1: Databricks Blog — https://www.databricks.com/blog/what-is-tool-calling
- S2: arXiv — Multi-Step Tool-Calling over Korean Open Public APIs (KOPA-Bench) — https://arxiv.org/abs/2609.05395v1
- S3: arXiv — Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use — https://arxiv.org/abs/2609.24985v1
- S4: arXiv — PalmClaw: A Native On-Device Agent Framework for Mobile Phones — https://arxiv.org/abs/2607.13027v1
- S6: AI Engineering by Chip Huyen — part 279 — pack://ai-engineering-by-chip-huyen
- S7: Anthropic Engineering — Code execution with MCP: Building more efficient agents — https://www.anthropic.com/engineering/code-execution-with-mcp
- S8: arXiv — X-AgentRed: Red-Teaming Personal Agents in Evolving Multi-Service Ecosystems — https://arxiv.org/abs/2610.13886v1
- S10: Hacker News — MXC - a sandboxed code execution system — https://github.com/microsoft/mxc
- S13: arXiv — Work Agents: Systems, Capabilities, and Optimization — https://arxiv.org/abs/2610.35845v1
- S14: Databricks Blog — Beyond dashboards: Introducing Decision Execution Platforms — https://www.databricks.com/blog/beyond-dashboards-introducing-decision-execution-platforms
