---
title: "Tool Calls: How Language Models Act on the World"
description: "A technical explainer on tool calling \u2014 the mechanism that lets language models invoke external functions, APIs, and services to extend their capabilities beyond text generation."
date: "2026-09-26"
format: "explainer"
concept: "tool calls"
tldr: ["Tool calling gives language models a structured way to request external actions \u2014 searching the web, querying databases, executing code, controlling devices \u2014 and receive results back as structured data.", "The model emits a special formatted message (name + arguments) that the host system executes; the result is returned as a new message, closing the loop.", "Multi-step tool use \u2014 chaining calls, handling failures, deciding when to stop \u2014 is where most complexity and current research effort live.", "Frameworks differ in how they describe tools (JSON Schema, OpenAPI, custom), how they manage conversation history, and whether they execute tools directly or via generated code.", "Tool calling turns a static model into an agent that can operate in real environments, but it adds latency, failure modes, and security surface that must be engineered around."]
references: ["S1: Databricks Blog \u2014 What is Tool Calling? \u2014 https://www.databricks.com/blog/what-is-tool-calling", "S2: arXiv \u2014 Multi-Step Tool-Calling over Korean Open Public APIs \u2014 https://arxiv.org/abs/2609.05395v1", "S3: arXiv \u2014 Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use \u2014 https://arxiv.org/abs/2609.24985v1", "S4: arXiv \u2014 PalmClaw: A Native On-Device Agent Framework for Mobile Phones \u2014 https://arxiv.org/abs/2607.13027v1", "S6: AI Engineering by Chip Huyen \u2014 part 279 \u2014 pack://ai-engineering-by-chip-huyen", "S7: Anthropic Engineering \u2014 Code execution with MCP \u2014 https://www.anthropic.com/engineering/code-execution-with-mcp", "S10: arXiv \u2014 Taxonomy-Driven Analysis of Open-Source AI Risk Mitigation Tools \u2014 https://arxiv.org/abs/2608.07446v1", "S11: arXiv \u2014 Workflow as Knowledge: Semantic Persistence for LLM-Mediated Workflows \u2014 https://arxiv.org/abs/2607.08740v1", "S12: arXiv \u2014 Desktop-Delta Bench \u2014 https://arxiv.org/abs/2607.26041v1"]
writer: "openrouter/nvidia/nemotron-3-ultra-550b-a55b:free"
fact_check: "passed"
diagram: "2026-09-26-tool-calls-how-language-models-act-on-the-world.json"
---

## What it is

Tool calling (also called function calling) is a protocol that lets a language model request the execution of an external function and receive its structured result. The model does not run the code itself. Instead, it emits a specially formatted message — typically a JSON object containing a function name and argument values — that the surrounding system intercepts, executes against the real function, and returns the output as a new message in the conversation. The model then continues reasoning with that result in context.

Think of it as a remote procedure call (RPC) where the *client* is a probabilistic language model. The model decides *what* to call and *with what arguments*; the host guarantees *that* it runs and *what* comes back. The contract between them is a schema: each tool declares its name, description, and parameter types (usually JSON Schema). The model learns to respect that schema through training and prompting.

This is distinct from the older pattern of "tool use" where models emitted free-form text like `SEARCH[weather Paris]` that required fragile parsing. Tool calling uses a dedicated message role (often `tool` or `function`) and a rigid format, making it machine-readable and composable.

[S1] defines tool calling as "the ability of an AI model to interact with external tools, APIs, and services," emphasizing that the model *requests* actions rather than performing them directly.

## Why it matters

Without tool calling, a language model is a closed system: its knowledge is frozen at training cutoff, it cannot access private data, and it cannot effect change in the world. Tool calling solves three fundamental limitations:

1. **Knowledge freshness and scope** — A model can query a search API, a SQL database, or an internal wiki to retrieve information that did not exist or was not memorized during training.
2. **Action and side effects** — A model can send an email, create a Jira ticket, deploy a container, or toggle a smart light. The model becomes an *actor*, not just an oracle.
3. **Computation and precision** — A model can offload exact arithmetic, data transformation, or code execution to a deterministic runtime, avoiding hallucinated numbers or logic errors.

The shift is architectural: the model moves from "generate the answer" to "decide the next step." This enables *agents* — systems that pursue goals over multiple turns, adapting to tool results, errors, and new information.

[S6] notes that different tasks demand different tool sets (science QA needs retrieval; tabular math needs computation) and different models exhibit different tool preferences (GPT-4 favors knowledge retrieval; ChatGPT favors image captioning). This implies tool calling is not a binary capability but a *surface* that must be designed and evaluated per application.

## How it works

### The protocol

A typical tool-calling loop:

1. **Tool definitions** are injected into the system prompt or passed via a dedicated API parameter (e.g., OpenAI's `tools` array). Each definition includes a JSON Schema for parameters.
2. **User message** arrives.
3. **Model responds** with either a normal assistant message (text) *or* a tool-call message containing one or more `{name, arguments}` objects.
4. **Host executes** each call: validates arguments against the schema, invokes the function, captures the result (or error).
5. **Host appends** a tool-result message (role `tool`, `tool_call_id`, content) for each call.
6. **Loop repeats** from step 3 until the model emits a final text response.

### Concrete example

*User asks:* "What's the current temperature in Tokyo?"

*System provides tool:* `get_weather(location: string) -> {temp_c: number, condition: string}`

*Model emits:*
```json
{"tool_calls": [{"id": "call_123", "name": "get_weather", "arguments": "{\"location\": \"Tokyo\"}"}]}
```

*Host calls the weather API, gets:* `{"temp_c": 22, "condition": "clear"}`

*Host appends:*
```json
{"role": "tool", "tool_call_id": "call_123", "content": "{\"temp_c\": 22, \"condition\": \"clear\"}"}
```

*Model replies:* "It's 22°C and clear in Tokyo right now."

### Key components

- **Schema contract**: The JSON Schema is the API boundary. Vague descriptions cause mis-calls; over-specified schemas confuse the model. Good schemas include enums, descriptions, and examples.
- **Execution sandbox**: The host must run tools safely — timeouts, rate limits, authentication, network isolation. A tool that hangs or leaks credentials is a system failure.
- **Conversation management**: Tool results consume context window. Long-running agents need summarization, truncation, or structured memory (see [S11] on semantic persistence).
- **Error handling**: Tools fail. The host must return structured errors so the model can retry, switch tools, or ask for clarification.

## Key techniques and variants

### Direct tool calling vs. code execution

The standard pattern (above) has the model emit *data* (arguments) and the host runs *code*. An alternative, advocated by Anthropic's MCP (Model Context Protocol), has the model *write code* that calls tools, then executes that code in a sandbox [S7]. Trade-offs:

| Dimension | Direct tool calls | Code execution (MCP) |
|---|---|---|
| Context overhead | Each tool definition + result adds tokens | One tool definition (the code interpreter); model writes logic |
| Flexibility | Fixed signatures | Arbitrary composition, loops, conditionals |
| Debuggability | Opaque model decisions | Code is inspectable, reproducible |
| Latency | One round-trip per call | Fewer round-trips; model does more locally |
| Safety | Host validates each call | Sandbox must contain arbitrary code |

[S7] argues agents scale better by writing code because "direct tool calls consume context for each definition and result."

### Single-step vs. multi-step

Early benchmarks measured one-call accuracy. Real workloads require *chains*: search → extract → calculate → write. [S2] introduces KOPA-Bench, a benchmark of 145 real-world tasks requiring multi-step calls across live Korean government APIs. They find open-source models "consistently underperform" in this setting. Their EDGE method synthesizes training data by building a graph of verified tool-output-to-input links from *actual* API executions, then traversing it to generate executable trajectories. Fine-tuning a 9B model on this data nearly matches an untuned 27B model from the same family.

### Training for tool use

[S3] diagnoses *which* model calls in a multi-turn trajectory are actually trainable. They introduce Critical-State RL: given candidate calls and local rewards, they use nested sampling to separate action-dependent reward variation from downstream noise. On BFCL v4, training only the selected states improves missing-function tasks by ~14 percentage points, while training alternative states leaves performance flat or worse. This suggests most turns in a tool trajectory are not learnable signal — a crucial insight for data efficiency.

### On-device and mobile

[S4] presents PalmClaw, an agent framework running natively on phones. It exposes device capabilities (contacts, camera, sensors, apps) as *device tools* with explicit arguments, structured results, and "clearly defined execution boundaries." This avoids the fragility of GUI automation (tap/swipe sequences) and yields 11.5% relative improvement in task success with 94.9% less completion time vs. the strongest baseline.

### Tool selection and ablation

[S6] recommends ablation studies: remove each tool and measure performance drop. If removal doesn't hurt, drop the tool. Plot tool-call distributions to see what's used and what's misunderstood. If a tool resists prompting and fine-tuning, *change the tool* — simplify its signature, split it, or replace it.

## Applications

- **Customer support agents**: Look up orders, process refunds, query knowledge bases, escalate to humans.
- **Data analysts**: Write and execute SQL, call visualization libraries, fetch from warehouses, output reports.
- **DevOps automation**: Provision infrastructure, tail logs, run migrations, roll back deployments.
- **Personal assistants**: Calendar management, email drafting, travel booking, smart-home control.
- **Research assistants**: Search papers, extract tables, run simulations, compile bibliographies.
- **Mobile agents**: [S4] demonstrates on-device control of contacts, messages, camera, and third-party apps via explicit tool interfaces.
- **Government/civic services**: [S2] targets multi-step tasks across live public APIs (tax filing, permit lookup, benefit eligibility) where data sovereignty demands on-premise open models.

## Trade-offs and limitations

### Latency and cost
Each tool call adds a network round-trip (or process spawn) plus model inference for the next turn. A 5-step task may take 10–30 seconds and 5–10× the token cost of a single completion.

### Failure cascades
A single mis-called tool (wrong argument, hallucinated function) can derail the whole trajectory. The model may not recover, or may compound errors. [S3] shows that training signal is sparse — only specific states are learnable — so naive RL on full trajectories is inefficient.

### Security surface
Every tool is an attack vector: prompt injection via tool results, excessive permissions, data exfiltration, unauthorized actions. Tools must be least-privilege, audited, and sandboxed. [S10] maps 21 open-source risk-mitigation tools to the MIT AI Risk Taxonomy, finding coverage skewed toward technical controls, with gaps in governance and legal categories.

### Evaluation difficulty
End-to-end success rates hide step-level failures. [S12] introduces Desktop-Delta Bench to measure whether models *understand* GUI transitions (causal state changes), not just final outcomes. They find ordering accuracy ~65% even for strong models — models often misread stale or occluded observations as progress.

### Schema brittleness
Models struggle with complex nested schemas, optional fields, and oneOf/anyOf. Simplifying schemas (flattening, splitting tools) often improves reliability more than prompt engineering.

### When *not* to use tool calling
- The task is pure reasoning/knowledge within the model's training distribution.
- Latency budget is sub-second and the tool is not local.
- The action is irreversible and high-stakes without human-in-the-loop.
- The tool set is large and unstable — prefer a code-execution sandbox where the model writes adaptors.

## Further reading

- **Databricks: What is Tool Calling?** — Accessible overview of the protocol and its role in agent systems. [S1]
- **KOPA-Bench & EDGE** — Multi-step benchmark on live public APIs; execution-grounded data synthesis. [S2]
- **Critical-State RL** — Diagnosing which turns in a tool trajectory are actually trainable. [S3]
- **PalmClaw** — On-device agent framework with device tools and explicit execution boundaries. [S4]
- **AI Engineering (Chip Huyen), Ch. 6** — Tool evaluation, ablation, and model-specific tool preferences. [S6]
- **Anthropic: Code Execution with MCP** — Argument for code-as-tool-interface over direct calls. [S7]
- **Workflow as Knowledge** — Semantic persistence for tool-mediated workflows (derive vs. infer). [S11]
- **Desktop-Delta Bench** — Step-level evaluation of causal state understanding in computer-use agents. [S12]

## References

- S1: Databricks Blog — What is Tool Calling? — https://www.databricks.com/blog/what-is-tool-calling
- S2: arXiv — Multi-Step Tool-Calling over Korean Open Public APIs — https://arxiv.org/abs/2609.05395v1
- S3: arXiv — Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use — https://arxiv.org/abs/2609.24985v1
- S4: arXiv — PalmClaw: A Native On-Device Agent Framework for Mobile Phones — https://arxiv.org/abs/2607.13027v1
- S6: AI Engineering by Chip Huyen — part 279 — pack://ai-engineering-by-chip-huyen
- S7: Anthropic Engineering — Code execution with MCP — https://www.anthropic.com/engineering/code-execution-with-mcp
- S10: arXiv — Taxonomy-Driven Analysis of Open-Source AI Risk Mitigation Tools — https://arxiv.org/abs/2608.07446v1
- S11: arXiv — Workflow as Knowledge: Semantic Persistence for LLM-Mediated Workflows — https://arxiv.org/abs/2607.08740v1
- S12: arXiv — Desktop-Delta Bench — https://arxiv.org/abs/2607.26041v1

## References

- S1: Databricks Blog — What is Tool Calling? — https://www.databricks.com/blog/what-is-tool-calling
- S2: arXiv — Multi-Step Tool-Calling over Korean Open Public APIs — https://arxiv.org/abs/2609.05395v1
- S3: arXiv — Critical-State RL: Diagnosing Trainable States for Multi-Turn Tool Use — https://arxiv.org/abs/2609.24985v1
- S4: arXiv — PalmClaw: A Native On-Device Agent Framework for Mobile Phones — https://arxiv.org/abs/2607.13027v1
- S6: AI Engineering by Chip Huyen — part 279 — pack://ai-engineering-by-chip-huyen
- S7: Anthropic Engineering — Code execution with MCP — https://www.anthropic.com/engineering/code-execution-with-mcp
- S10: arXiv — Taxonomy-Driven Analysis of Open-Source AI Risk Mitigation Tools — https://arxiv.org/abs/2608.07446v1
- S11: arXiv — Workflow as Knowledge: Semantic Persistence for LLM-Mediated Workflows — https://arxiv.org/abs/2607.08740v1
- S12: arXiv — Desktop-Delta Bench — https://arxiv.org/abs/2607.26041v1
