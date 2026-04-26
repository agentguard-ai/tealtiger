"""
TealTiger + CrewAI Integration

Shows how to add TealTiger governance to a multi-agent CrewAI workflow:

    1. Tool allowlisting: every CrewAI tool call routes through
       TealTiger.execute_tool_sync(), which evaluates the policy that has
       been deployed to the Security Sidecar Agent (SSA). The example
       authors that policy with PolicyBuilder so the rules are visible in
       the same file.
    2. Cost tracking: a single CostTracker + InMemoryCostStorage is shared
       across every agent in the crew. Each Agent has its own agent_id, so
       per-agent totals and crew-wide totals both come from the same data.
    3. LLM wrapping: TealAnthropic plugs into a CrewAI Agent through a
       thin synchronous adapter. CrewAI calls llm.call(messages); the
       adapter forwards to TealAnthropic.messages.create() (async) and
       lets TealAnthropic record the cost record internally.

Run with:

    pip install 'crewai>=0.70'
    ANTHROPIC_API_KEY=sk-ant-...      # required for live LLM calls
    TEALTIGER_SSA_URL=http://...      # required for tool allowlist
    TEALTIGER_API_KEY=...
    python examples/python/crewai_integration.py

CrewAI-specific notes this example demonstrates:
    - CrewAI tools subclass BaseTool and implement _run; that is where the
      TealTiger allowlist hook belongs.
    - CrewAI's LLM contract is .call(messages, **kwargs) -> str. The
      adapter bridges that to TealAnthropic, whose API is async.
    - The TealTiger policy is enforced by the SSA, not by the local
      client. Deploy build_crew_policy() to your SSA before running.
"""

import asyncio
import os
from typing import Any, Dict, List

from crewai import Agent, Crew, Task  # type: ignore[import-untyped]
from crewai.tools import BaseTool  # type: ignore[import-untyped]

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


# 1. Policy authored locally so the rules are visible in this file. Deploy
#    the resulting Policy to your SSA so TealTiger.execute_tool_sync() can
#    enforce it. Anything not matched falls through to the default deny.
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


# 2. Guarded tool: every CrewAI tool _run() routes through TealTiger
#    first. A deny short-circuits the tool with a clear error; the agent
#    then sees the failure in its scratchpad and either tries another
#    tool or stops.
#
#    Each subclass declares its own typed _run() so CrewAI can derive an
#    args_schema from the signature. A base class with **kwargs would
#    drop the schema and the model would receive the tools as taking no
#    arguments.
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
        # ast.literal_eval rejects anything except literals; safe for a demo.
        import ast
        try:
            return str(ast.literal_eval(expression))
        except (ValueError, SyntaxError) as exc:
            return f"[calculator error: {exc}]"


# 3. LLM adapter: CrewAI agents accept any object exposing
#    .call(messages, **kwargs) -> str. We bridge that to TealAnthropic so
#    guardrails and the internal cost record happen on every agent turn.
#    main() is synchronous (see below) so asyncio.run() here is safe.
class TealAnthropicCrewAIAdapter:
    """Adapt TealAnthropic to CrewAI's LLM .call(messages) -> str protocol."""

    def __init__(
        self,
        teal_anthropic: TealAnthropic,
        model: str,
        max_tokens: int = 1024,
    ):
        self._client = teal_anthropic
        self._model = model
        self._max_tokens = max_tokens

    def call(self, messages: List[Dict[str, str]], **_: Any) -> str:
        response = asyncio.run(
            self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                messages=messages,
            )
        )
        # MessageCreateResponse.content is List[Dict[str, Any]] in the SDK,
        # not Anthropic's content-block objects.
        return response.content[0]["text"]


def main() -> None:
    # 4. Shared infrastructure: one TealTiger guard for tool calls, one
    #    cost tracker, and one storage. Every tool call and every LLM call
    #    funnels through these so per-agent and crew-total queries both
    #    work off the same data.
    guard = TealTiger(
        api_key=os.getenv("TEALTIGER_API_KEY", "demo-key"),
        ssa_url=os.getenv("TEALTIGER_SSA_URL", "http://localhost:3000"),
    )
    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(CostTrackerConfig(
        enabled=True,
        persist_records=True,
        enable_budgets=True,
        enable_alerts=True,
    ))

    # 5. Crew-wide budget. Multi-agent workflows fan out fast; a $5/day
    #    cap catches runaway crews before they bill. action="block" is
    #    what enforces the cap; action="alert" only emits warnings and
    #    still returns allowed=True from check_budget. Alert thresholds
    #    at 50/75/90 fire on the way to the cap. BudgetManager
    #    .create_budget takes positional fields, not a pre-built
    #    BudgetConfig.
    budget_manager = BudgetManager(storage)
    budget_manager.create_budget(
        name="Research Crew Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="block",
        enabled=True,
    )

    # 6. Policy is authored here and is expected to already be deployed to
    #    the SSA at TEALTIGER_SSA_URL. We log it once on startup so the
    #    rules show up in the example's output.
    policy = build_crew_policy()
    print(f"Loaded policy '{policy.name}' with {len(policy.rules)} rule(s)")
    for rule in policy.rules:
        print(f"  {rule['action'].upper()}: {rule['reason']}")
    print()

    # 7. Two agents, each tagged with its own agent_id. They share the
    #    tool guard, the cost tracker, and the storage.
    researcher_id = "agent-researcher"
    writer_id = "agent-writer"
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "demo-anthropic-key")

    researcher_llm = TealAnthropicCrewAIAdapter(
        teal_anthropic=TealAnthropic(TealAnthropicConfig(
            api_key=anthropic_key,
            agent_id=researcher_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
            budget_manager=budget_manager,
        )),
        model="claude-3-5-sonnet-20241022",
    )
    writer_llm = TealAnthropicCrewAIAdapter(
        teal_anthropic=TealAnthropic(TealAnthropicConfig(
            api_key=anthropic_key,
            agent_id=writer_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
            budget_manager=budget_manager,
        )),
        model="claude-3-5-sonnet-20241022",
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

    # 8. A trivial crew. The point of this example is the governance
    #    plumbing, not the prompt design.
    research_task = Task(
        description="Find three facts about open-source AI agent frameworks.",
        expected_output="A bulleted list of three facts, each with a source.",
        agent=researcher,
    )
    summary_task = Task(
        description="Summarise the research notes in two sentences.",
        expected_output="Two sentences, no longer than 60 words total.",
        agent=writer,
        context=[research_task],
    )
    crew = Crew(agents=[researcher, writer], tasks=[research_task, summary_task])

    # 9. Run the crew. Network calls are stubbed unless ANTHROPIC_API_KEY
    #    is set; the governance code paths execute either way.
    result = crew.kickoff()
    print("Crew output:\n", result)

    # 10. Cost summary across all agents in the crew. Records were written
    #     by TealAnthropic itself to the shared storage.
    print("\n=== Per-agent cost ===")
    for agent_id in (researcher_id, writer_id):
        records = asyncio.run(storage.get_by_agent_id(agent_id))
        total = sum(r.actual_cost for r in records)
        print(f"  {agent_id}: {len(records)} call(s), ${total:.6f}")


if __name__ == "__main__":
    main()
