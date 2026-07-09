# Integration Issues — Tier 1 & Tier 2

Create these at: https://github.com/agentguard-ai/tealtiger/issues/new

---

## TIER 1 — High Impact, High Feasibility

---

### Issue 1: Langfuse

**Title:** `[Integration]: Export governance decisions as Langfuse traces/spans`

**Labels:** `enhancement`, `integrations`, `priority:high`

**Body:**

### Summary

[Langfuse](https://github.com/langfuse/langfuse) is the leading OSS LLM observability platform (MIT license, 10k+ stars). TealTiger governance decisions should be emittable as Langfuse spans so teams can see governance enforcement inline with their LLM traces.

### Why Langfuse?

- Traces are their core model — a governance decision maps perfectly to a span
- MIT licensed, actively accepts community integrations
- Already supports LangChain, LlamaIndex, OpenAI SDK, Vercel AI SDK
- Teams already using Langfuse get governance visibility without switching tools

### Proposed integration

```python
from langfuse import Langfuse
from tealtiger.integrations.langfuse import LangfuseGovernanceExporter

langfuse = Langfuse()
exporter = LangfuseGovernanceExporter(langfuse)

client = TealOpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    guardrails={"pii_detection": True, "secret_detection": True},
    on_decision=exporter.trace,  # Each decision → Langfuse span
)
```

Each governance decision becomes a Langfuse span with:
- `name`: "tealtiger.governance"
- `metadata`: {action, reason_codes, risk_score, evaluation_time_ms, policy_digest}
- `level`: ERROR (deny), WARNING (monitor), DEFAULT (allow)

### Deliverables

- [ ] `tealtiger.integrations.langfuse` module
- [ ] Maps GovernanceDecision → Langfuse span with appropriate level
- [ ] Example showing governance spans in Langfuse trace viewer
- [ ] PR to Langfuse docs/community integrations page

---

### Issue 2: OpenAI Agents SDK

**Title:** `[Integration]: Governance middleware for OpenAI Agents SDK`

**Labels:** `enhancement`, `integrations`, `priority:high`

**Body:**

### Summary

The [OpenAI Agents SDK](https://github.com/openai/openai-agents-python) (shipped March 2026) is becoming the default agent framework for teams using OpenAI models. TealTiger should provide a governance guard that intercepts tool calls before execution — matching the SDK's guardrail pattern.

### Why OpenAI Agents SDK?

- Fastest-growing agent framework in 2026
- Has a built-in `Guardrail` concept — TealTiger maps directly to it
- Teams using it have no governance layer by default (only input/output guardrails, not tool-call governance)
- First-mover advantage: no other governance SDK has an official integration

### Proposed integration

```python
from agents import Agent, Runner
from tealtiger.integrations.openai_agents import TealTigerGuardrail

governance = TealTigerGuardrail(
    policies=["tool_allowlist:web_search,calculator", "pii_block", "cost_limit:5.00"],
    mode="enforce",
)

agent = Agent(
    name="research-agent",
    instructions="You help with research.",
    tools=[web_search, calculator],
    input_guardrails=[governance.input_guard],
    output_guardrails=[governance.output_guard],
)

result = Runner.run_sync(agent, "Find earnings data for ACME Corp")
```

### Deliverables

- [ ] `tealtiger.integrations.openai_agents` module
- [ ] `TealTigerGuardrail` class implementing OpenAI SDK's guardrail interface
- [ ] Tool-call interception (before execution)
- [ ] Input/output PII and secret scanning
- [ ] Example: governed OpenAI agent with audit trail
- [ ] Blog post announcing the integration

---

### Issue 3: Anthropic Agent SDK

**Title:** `[Integration]: Governance hooks for Anthropic Agent SDK`

**Labels:** `enhancement`, `integrations`, `priority:high`

**Body:**

### Summary

Anthropic shipped their [Agent SDK](https://github.com/anthropics/anthropic-sdk-python) in April 2026. TealTiger should provide governance middleware that works with Anthropic's tool-use pattern — evaluating tool calls before execution and scanning outputs for PII/secrets.

### Why Anthropic SDK?

- Second most popular vendor SDK after OpenAI
- Claude models are known for tool use — governance is critical
- No built-in governance beyond Anthropic's content filtering
- Teams running Claude agents in production need policy enforcement

### Proposed integration

```python
from anthropic import Anthropic
from tealtiger import TealAnthropic

# Drop-in governed client
client = TealAnthropic(
    api_key=os.environ["ANTHROPIC_API_KEY"],
    guardrails={"secret_detection": True, "pii_detection": True},
    budget={"max_cost_per_session": 10.00},
)

# All tool-use responses are governed before execution
response = client.messages.create(
    model="claude-sonnet-4-20250514",
    messages=[{"role": "user", "content": "Query the database for user records"}],
    tools=[...],
)
```

### Deliverables

- [ ] `TealAnthropic` client wrapper (mirrors existing `TealOpenAI` pattern)
- [ ] Tool-use result scanning before execution
- [ ] Cost tracking for Claude models (all tiers)
- [ ] Example: governed Claude agent workflow
- [ ] Documentation update

---

### Issue 4: Google ADK (Agent Development Kit)

**Title:** `[Integration]: Governance callbacks for Google Agent Development Kit`

**Labels:** `enhancement`, `integrations`, `priority:high`

**Body:**

### Summary

Google shipped the [Agent Development Kit (ADK)](https://github.com/google/adk-python) in April 2026. It's Python-native with a callback-based architecture that's ideal for governance hooks. TealTiger should integrate as a before_tool_call callback.

### Why Google ADK?

- Google's official agent framework — backed by Gemini models
- Callback-based architecture maps cleanly to governance hooks
- Growing adoption in enterprise (GCP ecosystem)
- No third-party governance integrations exist yet

### Proposed integration

```python
from google.adk import Agent, Tool
from tealtiger.integrations.google_adk import TealTigerCallback

governance = TealTigerCallback(
    guardrails={"pii_detection": True, "secret_detection": True},
    budget={"max_cost_per_session": 5.00},
)

agent = Agent(
    model="gemini-2.0-flash",
    tools=[search_tool, code_tool],
    before_tool_call=governance.evaluate,
    after_tool_call=governance.audit,
)
```

### Deliverables

- [ ] `tealtiger.integrations.google_adk` module
- [ ] `TealTigerCallback` for before_tool_call / after_tool_call hooks
- [ ] Gemini model cost tracking
- [ ] Example: governed Google ADK agent
- [ ] PR to Google ADK examples or community section

---

### Issue 5: Pydantic AI

**Title:** `[Integration]: Type-safe governance policies with Pydantic AI`

**Labels:** `enhancement`, `integrations`, `priority:high`

**Body:**

### Summary

[Pydantic AI](https://github.com/pydantic/pydantic-ai) brings type safety to AI agent development. TealTiger governance policies should be expressible as Pydantic models, giving teams schema validation, IDE autocomplete, and type-checked policy configuration.

### Why Pydantic AI?

- Strong developer experience focus — governance as typed config resonates
- Python-first community that values correctness
- Pydantic AI's tool system has pre/post hooks — natural governance insertion point
- "Policy as code with full type safety" is a compelling narrative

### Proposed integration

```python
from pydantic_ai import Agent
from tealtiger.integrations.pydantic_ai import GovernedAgent, GovernanceConfig

config = GovernanceConfig(
    mode="enforce",
    allowed_tools=["web_search", "calculator"],
    blocked_pii=["ssn", "credit_card"],
    max_cost_per_session=5.00,
)

agent = GovernedAgent(
    "openai:gpt-4o-mini",
    governance=config,  # Fully typed, validated at init
)

result = await agent.run("Research ACME Corp earnings")
```

### Deliverables

- [ ] `tealtiger.integrations.pydantic_ai` module
- [ ] `GovernanceConfig` as a Pydantic model with full validation
- [ ] `GovernedAgent` wrapper with tool-call governance
- [ ] Example showing typed governance policies
- [ ] Blog post: "Type-safe AI governance with Pydantic AI + TealTiger"

---

### Issue 6: n8n

**Title:** `[Integration]: TealTiger governance node for n8n workflows`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[n8n](https://github.com/n8n-io/n8n) is an OSS workflow automation platform with a visual builder. A TealTiger governance node would let non-developer teams add policy enforcement to their AI workflows without writing code.

### Why n8n?

- Visual builder reaches non-developer users (ops, compliance teams)
- Already has AI/LLM nodes — governance is the missing piece
- 50k+ stars, active community node ecosystem
- "Drag and drop governance" is a unique positioning

### Proposed integration

A custom n8n node that:
1. Takes input data (LLM response, tool call args)
2. Evaluates TealTiger policies (PII, secrets, cost)
3. Routes to "approved" or "blocked" output

### Deliverables

- [ ] `n8n-nodes-tealtiger` community node package
- [ ] Governance evaluation node with visual config
- [ ] Routes: approved / blocked / needs-review
- [ ] Example workflow: LLM → TealTiger Governance → Execute or Block
- [ ] Published to n8n community nodes registry

---

## TIER 2 — Good Fit, Moderate Effort

---

### Issue 7: Phoenix (Arize)

**Title:** `[Integration]: Governance spans in Phoenix LLM trace visualization`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[Phoenix](https://github.com/Arize-ai/phoenix) is Arize's OSS LLM observability tool. TealTiger governance decisions should appear as spans in Phoenix traces, answering "why didn't this tool call happen?" directly in the trace viewer.

### Proposed integration

Export governance decisions as OpenTelemetry spans that Phoenix auto-ingests:

```python
from tealtiger.integrations.phoenix import PhoenixGovernanceSpanExporter

exporter = PhoenixGovernanceSpanExporter()
client = TealOpenAI(
    api_key=os.environ["OPENAI_API_KEY"],
    guardrails={"pii_detection": True},
    on_decision=exporter.export,
)
```

### Deliverables

- [ ] `tealtiger.integrations.phoenix` module
- [ ] OTel span exporter for governance decisions
- [ ] Example showing governance spans in Phoenix UI
- [ ] PR to Phoenix community examples

---

### Issue 8: LangGraph

**Title:** `[Integration]: Governance as a conditional routing node in LangGraph`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[LangGraph](https://github.com/langchain-ai/langgraph) is the top-rated agent framework for production in 2026. TealTiger governance maps naturally to a conditional node: evaluate policy → route to "continue" or "blocked" branch.

### Proposed integration

```python
from langgraph.graph import StateGraph
from tealtiger.integrations.langgraph import governance_node, should_continue

workflow = StateGraph(AgentState)
workflow.add_node("governance", governance_node)
workflow.add_node("execute_tool", execute_tool)
workflow.add_node("blocked", handle_blocked)

workflow.add_conditional_edges(
    "governance",
    should_continue,  # Routes based on TealTiger decision
    {"continue": "execute_tool", "blocked": "blocked"},
)
```

### Deliverables

- [ ] `tealtiger.integrations.langgraph` module
- [ ] `governance_node` function compatible with LangGraph's node interface
- [ ] `should_continue` routing function based on governance decision
- [ ] Example: governed LangGraph agent with policy branching
- [ ] Tutorial/blog post

---

### Issue 9: Dify

**Title:** `[Integration]: TealTiger governance plugin for Dify visual agent builder`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[Dify](https://github.com/langgenius/dify) is an OSS visual AI agent builder with 50k+ stars. A TealTiger tool/plugin would let teams add governance blocks to their visual workflows.

### Proposed integration

A Dify tool that:
- Accepts text input (LLM output, tool args)
- Scans for PII, secrets, policy violations
- Returns allow/deny decision with reason codes
- Configurable via Dify's visual tool config

### Deliverables

- [ ] Dify tool plugin implementing governance scanning
- [ ] Visual configuration (select guardrails, set budget)
- [ ] Example Dify workflow with governance gate
- [ ] Published to Dify marketplace/tools

---

### Issue 10: Portkey

**Title:** `[Integration]: Governance metadata in Portkey AI gateway`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[Portkey](https://github.com/portkey-ai/gateway) is an AI gateway that routes and observes LLM calls. TealTiger governance decisions should flow as metadata through Portkey, so teams see governance status alongside latency, cost, and reliability metrics.

### Proposed integration

```python
from portkey_ai import Portkey
from tealtiger.integrations.portkey import TealTigerPortkeyHook

portkey = Portkey(api_key="your-key")
governance = TealTigerPortkeyHook(
    guardrails={"pii_detection": True, "secret_detection": True},
)

# Governance metadata attached to every Portkey-routed request
portkey.add_hook("before_request", governance.evaluate)
```

### Deliverables

- [ ] `tealtiger.integrations.portkey` module
- [ ] Before-request hook for governance evaluation
- [ ] Governance metadata (action, risk_score, reason_codes) in Portkey logs
- [ ] Example: governed multi-provider routing with Portkey + TealTiger

---

### Issue 11: MLflow

**Title:** `[Integration]: Log governance decisions as MLflow artifacts for compliance`

**Labels:** `enhancement`, `integrations`, `priority:medium`

**Body:**

### Summary

[MLflow](https://github.com/mlflow/mlflow) is the standard for ML experiment tracking and model management. Enterprise teams using MLflow for their ML lifecycle should be able to log TealTiger governance decisions as run artifacts — providing compliance evidence alongside model metrics.

### Proposed integration

```python
import mlflow
from tealtiger.integrations.mlflow import MLflowGovernanceLogger

logger = MLflowGovernanceLogger()

with mlflow.start_run():
    client = TealOpenAI(
        api_key=os.environ["OPENAI_API_KEY"],
        guardrails={"pii_detection": True},
        on_decision=logger.log,  # Each decision → MLflow artifact
    )
    # ... agent workflow ...
    logger.finalize()  # Export summary as SARIF artifact
```

### Deliverables

- [ ] `tealtiger.integrations.mlflow` module
- [ ] Log individual decisions as MLflow metrics (risk_score, latency)
- [ ] Export governance summary as SARIF/JSON artifact at run end
- [ ] Example: governed agent run with full MLflow tracking
- [ ] Tags: total_denials, max_risk_score, governance_mode

---

## TIER 3 — Niche but Strategic

---

### Issue 12: Open WebUI

**Title:** `[Integration]: Governance filter for Open WebUI chat interfaces`

**Labels:** `enhancement`, `integrations`, `priority:low`

**Body:**

### Summary

[Open WebUI](https://github.com/open-webui/open-webui) is the most popular frontend for Ollama and local LLMs (30k+ stars). A TealTiger filter would add PII/secret scanning to chat messages before they reach the local model — filling the gap where local models have no content filtering.

### Deliverables

- [ ] Open WebUI filter/plugin for TealTiger governance
- [ ] Scans user inputs and model outputs for PII/secrets
- [ ] Visual indicator when messages are blocked
- [ ] Admin config panel for policy settings

---

### Issue 13: Helicone

**Title:** `[Integration]: Governance headers in Helicone LLM proxy`

**Labels:** `enhancement`, `integrations`, `priority:low`

**Body:**

### Summary

[Helicone](https://github.com/Helicone/helicone) proxies LLM calls for observability. TealTiger governance metadata (decision, risk_score, reason_codes) should flow as custom headers through Helicone, making governance visible in their dashboard without additional integration work.

### Deliverables

- [ ] Custom header injection: `X-TealTiger-Action`, `X-TealTiger-Risk-Score`
- [ ] Helicone dashboard shows governance status per request
- [ ] Example: governed OpenAI calls proxied through Helicone

---

### Issue 14: Opik (Comet)

**Title:** `[Integration]: Governance evaluation as Opik test cases`

**Labels:** `enhancement`, `integrations`, `priority:low`

**Body:**

### Summary

[Opik](https://github.com/comet-ml/opik) (by Comet, Apache 2.0) is an LLM evaluation framework. TealTiger governance correctness should be testable as Opik evaluation cases — "Did governance make the right decision given this input?"

### Deliverables

- [ ] `tealtiger.integrations.opik` module
- [ ] Define governance evaluation metrics (false positive rate, false negative rate)
- [ ] Test cases: "should block PII", "should allow clean input", "should enforce budget"
- [ ] Example: evaluate governance policy accuracy with Opik

---

### Issue 15: Mastra

**Title:** `[Integration]: Governance middleware for Mastra TypeScript agent framework`

**Labels:** `enhancement`, `integrations`, `priority:low`, `typescript`

**Body:**

### Summary

[Mastra](https://github.com/mastra-ai/mastra) is a growing TypeScript agent framework. TealTiger's TypeScript SDK should provide middleware compatible with Mastra's tool execution pipeline.

### Deliverables

- [ ] `@tealtiger/mastra` package
- [ ] Middleware that intercepts tool calls in Mastra agents
- [ ] TypeScript-native governance with full type safety
- [ ] Example: governed Mastra agent

