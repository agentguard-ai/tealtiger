---
layout: post
title: "Building a Governed Multi-Agent System with CrewAI and TealTiger"
description: "A practical CrewAI walkthrough showing how TealTiger enforces tool allowlists, per-agent cost tracking, and audit-ready evidence."
date: 2026-06-08
permalink: /governance/frameworks/governed-multi-agent-crewai/
category: governance
hub: frameworks
author: Chad Nelson (@CleanDev-Fix)
author_github: https://github.com/CleanDev-Fix
author_role: Trusted Contributor

tags:
  - crewai
  - tealtiger
  - multi-agent
  - runtime-governance
  - auditability
---

# Building a Governed Multi-Agent System with CrewAI and TealTiger

CrewAI is a strong fit for layered agent workflows, but the moment you let one
agent call tools, hand work to another agent, and keep a running budget, the
control surface gets wider fast. That is where TealTiger helps: it gives you a
deterministic governance layer around tool execution, cost attribution, and
audit evidence without forcing you to rebuild the workflow itself.

This article walks through a small research-and-writing crew with three
governance controls:

1. Tool calls are allowlisted through TealTiger before execution.
2. Cost is tracked per agent, not just per crew.
3. Every decision can be audited and exported later.

The goal is not to make CrewAI smaller. The goal is to make it safer to run in
production, where tool use, spend, and traceability matter.

## What the demo does

The example below uses two agents:

- a researcher that can use a governed `web_search` tool
- a writer that can use a governed `calculator` tool

TealTiger enforces a simple default-deny policy:

- allow `web_search`
- allow `calculator`
- deny everything else

That is enough to show the governance pattern. In a real deployment, you would
replace the demo policy with your SSA-backed policy and keep the same workflow
shape.

## Why governance belongs around the tools

The risky part of a multi-agent workflow is rarely the prompt. It is usually the
thing the agent is allowed to do next:

- call a tool that should be restricted
- keep spending after a crew-level budget should have stopped it
- produce output with no reliable audit trail

TealTiger addresses those concerns at the boundary where the action happens.
That matters because the control is deterministic: the same policy and the same
input produce the same decision.

This makes the runtime behavior easier to reason about and easier to defend in
post-incident review.

## Before and after governance

Without governance, a CrewAI tool call is just a tool call. A researcher can
accidentally reach for something that should never have been available, and the
only thing stopping it is prompt quality.

With TealTiger in the path:

- the tool call is checked before execution
- the decision is attached to the agent identity
- cost records are attributed to the same agent
- the result can be queried later through the audit trail

That gives you a workflow that is still flexible, but no longer opaque.

## Full working Python example

The following script is a complete example. It uses the same integration
pattern as the checked-in `examples/python/crewai_integration.py` file:

```python
import ast
import asyncio
import os
from typing import Any, Dict

from crewai import Agent, BaseLLM, Crew, Task
from crewai.tools import BaseTool

from tealtiger import (
    BudgetManager,
    CostTracker,
    CostTrackerConfig,
    InMemoryCostStorage,
    PolicyBuilder,
    TealAnthropic,
    TealAnthropicConfig,
    TealTiger,
)

DEMO_MODEL = "claude-3-haiku-20240307"


def build_crew_policy():
    return (
        PolicyBuilder()
        .name("crewai-tool-allowlist")
        .description("Tools the research crew is allowed to invoke")
        .add_rule(
            condition={"tool_name": "web_search"},
            action="allow",
            reason="Public web search is permitted for research",
        )
        .add_rule(
            condition={"tool_name": "calculator"},
            action="allow",
            reason="Deterministic math is safe",
        )
        .add_rule(
            condition={"tool_name": "*"},
            action="deny",
            reason="Default deny: tools must be explicitly allowlisted",
        )
        .build()
    )


def _guard_call(
    guard: TealTiger,
    tool_name: str,
    agent_id: str,
    parameters: Dict[str, Any],
):
    return guard.execute_tool_sync(
        tool_name=tool_name,
        parameters=parameters,
        context={
            "session_id": "crewai-demo",
            "user_id": "demo-user",
            "agent_id": agent_id,
        },
    )


class WebSearchTool(BaseTool):
    name: str = "web_search"
    description: str = "Search the public web and return result snippets"

    def __init__(self, guard: TealTiger, agent_id: str):
        super().__init__()
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, query: str) -> str:
        result = _guard_call(self._guard, self.name, self._agent_id, {"query": query})
        if not result.success:
            return f"[blocked by TealTiger: {result.error}]"
        return f"[stub web_search result for {query!r}]"


_ARITH_NODES = (
    ast.Expression,
    ast.BinOp,
    ast.UnaryOp,
    ast.Constant,
    ast.Add,
    ast.Sub,
    ast.Mult,
    ast.Div,
    ast.FloorDiv,
    ast.Mod,
    ast.Pow,
    ast.USub,
    ast.UAdd,
)


def _safe_arith(expression: str) -> float:
    tree = ast.parse(expression, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ARITH_NODES):
            raise ValueError(f"unsupported syntax: {type(node).__name__}")
        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
            raise ValueError(f"unsupported constant: {node.value!r}")
    return eval(compile(tree, "<calculator>", "eval"))  # noqa: S307


class CalculatorTool(BaseTool):
    name: str = "calculator"
    description: str = "Evaluate a deterministic arithmetic expression"

    def __init__(self, guard: TealTiger, agent_id: str):
        super().__init__()
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, expression: str) -> str:
        result = _guard_call(
            self._guard, self.name, self._agent_id, {"expression": expression}
        )
        if not result.success:
            return f"[blocked by TealTiger: {result.error}]"
        try:
            return str(_safe_arith(expression))
        except (ValueError, SyntaxError, ZeroDivisionError) as exc:
            return f"[calculator error: {exc}]"


class TealAnthropicLLM(BaseLLM):
    def __init__(self, teal_anthropic: TealAnthropic, model: str, max_tokens: int = 1024):
        super().__init__(model=model)
        self.__dict__["_client"] = teal_anthropic
        self.__dict__["_max_tokens"] = max_tokens

    def call(  # type: ignore[override]
        self,
        messages,
        tools=None,
        callbacks=None,
        available_functions=None,
        from_task=None,
        from_agent=None,
        response_model=None,
    ) -> str:
        if isinstance(messages, str):
            messages = [{"role": "user", "content": messages}]
        response = asyncio.run(
            self._client.messages.create(
                model=self.model,
                max_tokens=self._max_tokens,
                messages=messages,
            )
        )
        return response.content[0]["text"]


def main() -> None:
    guard = TealTiger(
        api_key=os.getenv("TEALTIGER_API_KEY", "demo-key"),
        ssa_url=os.getenv("TEALTIGER_SSA_URL", "http://localhost:3000"),
    )

    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(
        CostTrackerConfig(
            enabled=True,
            persist_records=True,
            enable_budgets=True,
            enable_alerts=True,
        )
    )

    budget_manager = BudgetManager(storage)
    budget_manager.create_budget(
        name="Research Crew Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="block",
        enabled=True,
    )

    policy = build_crew_policy()
    print(f"Loaded policy '{policy.name}' with {len(policy.rules)} rule(s)")

    researcher_id = "agent-researcher"
    writer_id = "agent-writer"
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "demo-anthropic-key")

    researcher_llm = TealAnthropicLLM(
        teal_anthropic=TealAnthropic(
            TealAnthropicConfig(
                api_key=anthropic_key,
                agent_id=researcher_id,
                cost_tracker=cost_tracker,
                cost_storage=storage,
                budget_manager=budget_manager,
            )
        ),
        model=DEMO_MODEL,
    )
    writer_llm = TealAnthropicLLM(
        teal_anthropic=TealAnthropic(
            TealAnthropicConfig(
                api_key=anthropic_key,
                agent_id=writer_id,
                cost_tracker=cost_tracker,
                cost_storage=storage,
                budget_manager=budget_manager,
            )
        ),
        model=DEMO_MODEL,
    )

    researcher = Agent(
        role="Researcher",
        goal="Gather background facts about a topic using web search",
        backstory="A meticulous researcher who cites sources",
        tools=[WebSearchTool(guard, researcher_id)],
        llm=researcher_llm,
        verbose=False,
        allow_delegation=False,
    )
    writer = Agent(
        role="Writer",
        goal="Turn research notes into a short brief",
        backstory="A concise writer who avoids speculation",
        tools=[CalculatorTool(guard, writer_id)],
        llm=writer_llm,
        verbose=False,
        allow_delegation=False,
    )

    research_task = Task(
        description="Find three facts about open-source AI agent frameworks.",
        expected_output="A bulleted list of three facts, each with a source.",
        agent=researcher,
    )
    summary_task = Task(
        description="Summarize the research notes in two sentences.",
        expected_output="Two sentences, no longer than 60 words total.",
        agent=writer,
        context=[research_task],
    )

    crew = Crew(agents=[researcher, writer], tasks=[research_task, summary_task])
    result = crew.kickoff()
    print("Crew output:\n", result)

    print("\n=== Per-agent cost ===")
    for agent_id in (researcher_id, writer_id):
        records = asyncio.run(storage.get_by_agent_id(agent_id))
        total = sum(r.actual_cost for r in records)
        print(f"  {agent_id}: {len(records)} call(s), ${total:.6f}")


if __name__ == "__main__":
    main()
```

## What to look for in the output

When this runs, there are three useful checkpoints:

1. The policy loads and prints the allowlist rules.
2. Tool calls are either allowed or blocked before execution.
3. The cost summary is split by `agent_id`, so you can see which agent spent
   what.

In a real run, the most important line is often the blocked one. A denied tool
call is not a failure of the demo. It is the governance boundary doing its job.

Example output looks like this:

```text
Loaded policy 'crewai-tool-allowlist' with 3 rule(s)
  ALLOW: Public web search is permitted for research
  ALLOW: Deterministic math is safe
  DENY: Default deny: tools must be explicitly allowlisted

=== Per-agent cost ===
  agent-researcher: 1 call(s), $0.000123
  agent-writer: 1 call(s), $0.000087
```

Actual costs and tool responses will vary by model, provider, and whether you
run the example against a live SSA.

## Deployment notes

For local testing, the example can run with stubbed tool behavior and a local
policy evaluator. For production, the policy should be deployed to your SSA and
the environment should provide the real runtime credentials:

- `TEALTIGER_API_KEY`
- `TEALTIGER_SSA_URL`
- `ANTHROPIC_API_KEY`

The code does not need to change when you move from a local demo to a governed
production setup. That is the point of the adapter layer.

## Why this pattern holds up

The combination of CrewAI plus TealTiger gives you a practical division of
responsibility:

- CrewAI handles coordination, task flow, and agent behavior.
- TealTiger handles tool authorization, cost governance, and evidence.

That separation keeps the workflow readable. It also keeps governance from
becoming a pile of custom checks scattered through tool classes and prompts.

If you are building multi-agent systems that need to survive review, audit, or
budget pressure, start with a narrow allowlist, attach every decision to an
agent identity, and make sure the audit trail is queryable from day one.
