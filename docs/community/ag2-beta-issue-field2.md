A TealTiger governance Extension contributed under `autogen/beta/extensions/tealtiger/` that implements composable middleware for the Beta agent runtime.

**Example usage:**

```python
from autogen.beta import Agent
from autogen.beta.config import OpenAIConfig
from autogen.beta.extensions.tealtiger import TealTigerMiddleware

agent = Agent(
    "assistant",
    config=OpenAIConfig("gpt-4o-mini"),
    tools=[my_tool],
    middleware=[
        TealTigerMiddleware(
            mode="enforce",
            policies=[
                {"type": "tool_allowlist", "allowed": ["search", "read_file"]},
                {"type": "pii_block", "categories": ["ssn", "credit_card"]},
                {"type": "cost_limit", "max_per_session": 5.00},
            ],
        )
    ],
)

reply = await agent.ask("Find info about project X")
```

**Capabilities:**

- Tool allowlisting via middleware interception
- PII detection and redaction in tool arguments
- Per-agent cost governance with budget ceilings
- Per-agent kill switch (freeze/unfreeze)
- REFER escalation (suspend for human review)
- Structured audit trail via MemoryStream events
- Decision receipts (SARIF v2.1.0, JUnit XML export)
- Deterministic evaluation, less than 5ms, no LLM in governance path

**Contribution details (per Extension policy):**

- Named maintainer: @nagasatish007
- Location: `autogen/beta/extensions/tealtiger/`
- Dependency: `tealtiger>=1.3.0` (guarded with try/except ImportError)
- Tests: Property-based (Hypothesis) + integration tests
- Docs: Google-style docstrings + Extensions docs page
