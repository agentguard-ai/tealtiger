---
title: "observe() — Python API"
description: "Complete API reference for observe(), freeze(), unfreeze(), and the ObserveProxy in the Python SDK."
---

# observe() — Python API

The zero-config entry point to TealTiger governance for Python. Wraps any supported LLM provider client with cost tracking, audit logging, PII detection, and behavioral baseline construction.

---

## observe()

```python
def observe(
    client: ProviderClient,
    *,
    agent_id: str | None = None,
    session_id: str | None = None,
    baseline_window: int = 100,
    role: str | None = None,
    exporters: list[GovernanceExporter] | None = None
) -> ObserveProxy
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `client` | `ProviderClient` | Yes | — | Any of the 14 supported LLM provider client instances |
| `agent_id` | `str` | No | Auto-generated UUID v4 | Unique identifier for this agent |
| `session_id` | `str` | No | Auto-generated UUID v4 | Unique identifier for this session |
| `baseline_window` | `int` | No | `100` | Number of requests to build the behavioral baseline |
| `role` | `str` | No | `None` | Agent role for role-based governance |
| `exporters` | `list[GovernanceExporter]` | No | `None` | Observability platform exporters |

### Returns

`ObserveProxy` — A transparent proxy with the same API surface as the original client, plus governance methods.

### Raises

| Error | When |
|-------|------|
| `UnsupportedProviderError` | The `client` argument is not one of the 14 supported provider types |

### Example

```python
from tealtiger import observe
from openai import OpenAI

# Minimal — zero config
client = observe(OpenAI())

# With configuration
client = observe(
    OpenAI(),
    agent_id="research-agent-01",
    session_id="session-abc-123",
    baseline_window=50
)

# Use exactly like the original client
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)
```

---

## Async Usage

`observe()` works with both sync and async clients:

```python
from tealtiger import observe
from openai import AsyncOpenAI

# Async client
client = observe(AsyncOpenAI(), agent_id="async-agent")

# Use with await
response = await client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)
```

```python
from tealtiger import observe
import anthropic

# Async Anthropic
client = observe(anthropic.AsyncAnthropic(), agent_id="anthropic-async")

response = await client.messages.create(
    model="claude-sonnet-4-20250514",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello"}]
)
```

---

## ObserveProxy Methods

The proxy returned by `observe()` has the same method surface as the original client, plus these governance methods:

### get_cost()

```python
def get_cost(self) -> CostSummary
```

Returns the accumulated cost for this session and agent.

```python
@dataclass
class CostSummary:
    session: float       # Total cost for this session (USD)
    agent: float         # Total cost for this agent across all sessions (USD)
    last_request: float  # Cost of the most recent request (USD)
    request_count: int   # Number of requests processed
```

**Example:**

```python
client = observe(OpenAI())

client.chat.completions.create(model="gpt-4o", messages=[...])
client.chat.completions.create(model="gpt-4o", messages=[...])

cost = client.get_cost()
print(cost.session)        # 0.0067
print(cost.request_count)  # 2
```

---

### get_baseline()

```python
def get_baseline(self) -> Baseline | None
```

Returns the behavioral baseline, or `None` if the baseline window hasn't been filled yet.

```python
@dataclass
class Baseline:
    request_count: int
    complete: bool
    stats: BaselineStats

@dataclass
class BaselineStats:
    latency: PercentileStats
    input_tokens: PercentileStats
    output_tokens: PercentileStats
    cost: PercentileStats
    tool_call_count: PercentileStats

@dataclass
class PercentileStats:
    p50: float
    p95: float
    p99: float
```

**Example:**

```python
client = observe(OpenAI(), baseline_window=50)

# After 50 requests...
baseline = client.get_baseline()
print(baseline.stats.latency.p50)   # 480
print(baseline.stats.cost.p95)      # 0.012
```

---

### get_agent_id()

```python
def get_agent_id(self) -> str
```

Returns the agent ID (auto-generated or configured).

---

### get_session_id()

```python
def get_session_id(self) -> str
```

Returns the session ID (auto-generated or configured).

---

### get_burn_rate()

```python
def get_burn_rate(self) -> float
```

Returns the current USD/minute spend rate based on recent requests.

---

### get_cost_by_agent()

```python
def get_cost_by_agent(self) -> dict[str, float]
```

Returns cost breakdown by agent ID.

---

## freeze()

```python
def freeze(agent_id: str) -> None
```

Immediately registers the given agent ID in the FreezeRegistry. All subsequent requests for that agent will be blocked with a `FrozenAgentError`.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | `str` | Yes | The agent ID to freeze. Use `"*"` to freeze all agents. |

### Behavior

- **Idempotent**: Calling `freeze(id)` multiple times is equivalent to calling it once
- **Immediate**: Takes effect for the very next request
- **In-memory**: No external service needed, persists for process lifetime
- **Wildcard**: `freeze("*")` freezes all agents, including agents created after the freeze call

### Example

```python
from tealtiger import freeze

# Freeze a specific agent
freeze("agent-research-01")

# Freeze ALL agents (emergency stop)
freeze("*")
```

---

## unfreeze()

```python
def unfreeze(agent_id: str) -> None
```

Removes the given agent ID from the FreezeRegistry.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `agent_id` | `str` | Yes | The agent ID to unfreeze. Use `"*"` to unfreeze the wildcard freeze. |

### Behavior

- **Safe**: Calling `unfreeze(id)` for an agent that isn't frozen completes without error
- **Immediate**: Takes effect for the very next request

### Example

```python
from tealtiger import freeze, unfreeze

freeze("agent-research-01")
# ... agent is blocked ...
unfreeze("agent-research-01")
# ... agent resumes normal operation ...
```

---

## FrozenAgentError

```python
class FrozenAgentError(TealTigerError):
    agent_id: str
    frozen_by: Literal["specific", "wildcard"]
    frozen_at: float  # Unix timestamp
```

Raised when a request is attempted on a frozen agent:

```python
from tealtiger import observe, freeze, FrozenAgentError
from openai import OpenAI

client = observe(OpenAI(), agent_id="demo")
freeze("demo")

try:
    client.chat.completions.create(model="gpt-4o", messages=[...])
except FrozenAgentError as e:
    print(e.agent_id)    # "demo"
    print(e.frozen_by)   # "specific"
```

---

## Supported Providers

| Provider | Client Type | Import |
|----------|------------|--------|
| OpenAI | `OpenAI` / `AsyncOpenAI` | `from openai import OpenAI, AsyncOpenAI` |
| Anthropic | `Anthropic` / `AsyncAnthropic` | `import anthropic` |
| Google Gemini | `GenerativeModel` | `import google.generativeai as genai` |
| AWS Bedrock | `bedrock-runtime client` | `import boto3` |
| Azure OpenAI | `AzureOpenAI` / `AsyncAzureOpenAI` | `from openai import AzureOpenAI` |
| Google Vertex AI | `GenerativeModel (vertexai)` | `from vertexai.generative_models import GenerativeModel` |
| Cohere | `Client` / `AsyncClient` | `import cohere` |
| Mistral | `Mistral` | `from mistralai import Mistral` |
| DeepSeek | `OpenAI` (custom base_url) | `from openai import OpenAI` |
| Groq | `Groq` / `AsyncGroq` | `from groq import Groq` |
| xAI | `OpenAI` (custom base_url) | `from openai import OpenAI` |
| Together | `Together` | `from together import Together` |
| HF-TGI | `InferenceClient` | `from huggingface_hub import InferenceClient` |

### DeepSeek / xAI Example

```python
from tealtiger import observe
from openai import OpenAI

# DeepSeek uses OpenAI-compatible API
deepseek = observe(
    OpenAI(base_url="https://api.deepseek.com/v1", api_key=os.environ["DEEPSEEK_KEY"])
)

# xAI uses OpenAI-compatible API
xai = observe(
    OpenAI(base_url="https://api.x.ai/v1", api_key=os.environ["XAI_KEY"])
)
```

---

## Complete Example

```python
from tealtiger import observe, freeze, unfreeze, FrozenAgentError
from openai import OpenAI

# 1. Wrap with observe
client = observe(
    OpenAI(),
    agent_id="demo-agent",
    session_id="session-001",
    baseline_window=20
)

# 2. Use normally
for i in range(25):
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Request {i}"}]
    )

# 3. Check accumulated data
cost = client.get_cost()
print(f"Session cost: ${cost.session:.4f}")
print(f"Requests: {cost.request_count}")

baseline = client.get_baseline()
print(f"Baseline complete: {baseline.complete}")
print(f"Latency p50: {baseline.stats.latency.p50}ms")

# 4. Emergency stop
freeze("demo-agent")

try:
    client.chat.completions.create(model="gpt-4o-mini", messages=[...])
except FrozenAgentError:
    print("Agent is frozen!")

# 5. Resume
unfreeze("demo-agent")
client.chat.completions.create(model="gpt-4o-mini", messages=[...])  # Works again
```

---

## Context Manager (Python-Specific)

The Python SDK supports a context manager pattern for session scoping:

```python
from tealtiger import observe
from openai import OpenAI

with observe(OpenAI(), agent_id="scoped-agent") as client:
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": "Hello"}]
    )
    print(client.get_cost())
# Session finalizes automatically on exit
```
