# CrewAI Governance Example

This example shows how to apply TealTiger Python SDK v1.3 governance to a
CrewAI multi-agent workflow.

It demonstrates:

- A CrewAI crew with a researcher agent and a writer agent
- Tool calls wrapped with `TealTiger.execute_tool_sync()`
- Per-agent cost tracking with `CostTracker` and `InMemoryCostStorage`
- A blocked policy violation for a risky `customer_export` tool

## Setup

From the repository root:

```bash
python -m venv .venv
source .venv/bin/activate
pip install "crewai>=1.0" "tealtiger==1.3.0"
python examples/crewai-governance/main.py
```

When working from this monorepo checkout, you can use the local Python SDK
instead of PyPI:

```bash
pip install "crewai>=1.0"
pip install -e packages/tealtiger-python
python examples/crewai-governance/main.py
```

## What It Does

The example builds this policy with `PolicyBuilder`:

- Allow `public_research` for public research notes
- Allow `calculator` for deterministic math
- Deny `customer_export`
- Deny every other tool by default

The default run uses a local TealTiger policy evaluator so the example is
repeatable without external services or model-provider API keys. Each CrewAI
agent still uses the TealTiger SDK interfaces for policy decisions and cost
tracking.

## Using A Live TealTiger SSA

To evaluate tool calls through a Security Sidecar Agent, deploy the policy from
`build_crew_policy()` to your SSA, then run:

```bash
export TEALTIGER_SSA_URL="http://localhost:3000"
export TEALTIGER_API_KEY="your-tealtiger-api-key"
python examples/crewai-governance/main.py
```

The same CrewAI tools will call `TealTiger.execute_tool_sync()`, but the policy
decision will come from the configured SSA instead of the local demo evaluator.
