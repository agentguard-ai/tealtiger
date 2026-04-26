"""
TealTiger + CrewAI Integration

Shows how to add TealTiger governance to a multi-agent CrewAI workflow:

    1. Tool allowlisting: every CrewAI tool call routes through
       TealTiger.execute_tool_sync() and is gated by a Policy.
    2. Cost tracking: a single CostTracker + InMemoryCostStorage is shared
       across every agent in the crew so totals aggregate cleanly per
       agent_id.
    3. LLM wrapping: TealAnthropic plugs into a CrewAI Agent through a
       thin adapter (CrewAI calls LLM.call(messages); the adapter forwards
       to TealAnthropic.messages.create() and records cost).

Run with:

    OPENAI_API_KEY=sk-...        # or ANTHROPIC_API_KEY=sk-ant-...
    pip install 'crewai>=0.55'   # CrewAI is Python-first; not bundled
    python examples/python/crewai_integration.py

CrewAI-specific notes this example demonstrates:
    - CrewAI tools subclass BaseTool and implement _run; that's where
      TealTiger's allowlist hook belongs.
    - CrewAI's LLM abstraction expects a .call(messages, **kwargs) -> str
      method; bridge to TealAnthropic via an adapter class.
    - Each Agent has its own agent_id; share storage but tag records with
      the agent so per-agent + crew-total cost queries both work.
"""

import asyncio
import os
from typing import Any, Dict, List

from crewai import Agent, Crew, Task  # type: ignore[import-untyped]
from crewai.tools import BaseTool  # type: ignore[import-untyped]

from tealtiger import (
    BudgetConfig,
    BudgetManager,
    CostTracker,
    CostTrackerConfig,
    InMemoryCostStorage,
    PolicyBuilder,
    TealAnthropic,
    TealTiger,
)


# 1. Policy: allowlist the tools this crew is allowed to call. Anything not
#    matched falls through to the default deny rule.
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


# 2. Guarded tool: every CrewAI tool _run() routes through TealTiger first.
#    A deny short-circuits the tool with a clear error; the agent then sees
#    the failure in its scratchpad and either tries another tool or stops.
class GuardedTool(BaseTool):
    """A CrewAI BaseTool that runs every call through TealTiger first."""

    name: str
    description: str

    def __init__(self, name: str, description: str, guard: TealTiger, agent_id: str):
        super().__init__(name=name, description=description)
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, **kwargs: Any) -> str:
        result = self._guard.execute_tool_sync(
            tool_name=self.name,
            parameters=kwargs,
            context={
                "session_id": "crewai-demo",
                "user_id": "demo-user",
                "agent_id": self._agent_id,
            },
        )
        if not result.success:
            return f"[blocked by TealTiger: {result.error}]"
        return self._actual_run(**kwargs)

    def _actual_run(self, **kwargs: Any) -> str:
        # Subclasses override this with the real tool logic. Stubbed here so
        # the example runs end-to-end without external services.
        return f"[stub {self.name} result for {kwargs!r}]"


class WebSearchTool(GuardedTool):
    def __init__(self, guard: TealTiger, agent_id: str):
        super().__init__(
            name="web_search",
            description="Search the public web and return a list of result snippets",
            guard=guard,
            agent_id=agent_id,
        )

    def _actual_run(self, query: str = "") -> str:
        return f"[stub web_search result for {query!r}]"


class CalculatorTool(GuardedTool):
    def __init__(self, guard: TealTiger, agent_id: str):
        super().__init__(
            name="calculator",
            description="Evaluate a deterministic arithmetic expression",
            guard=guard,
            agent_id=agent_id,
        )

    def _actual_run(self, expression: str = "") -> str:
        # ast.literal_eval rejects anything except literals; safe for a demo.
        import ast
        try:
            return str(ast.literal_eval(expression))
        except (ValueError, SyntaxError) as exc:
            return f"[calculator error: {exc}]"


# 3. LLM adapter: CrewAI agents accept any object with a .call(messages, ...)
#    method that returns a string. We forward to TealAnthropic so guardrails
#    + cost-record creation happen on every agent turn.
class TealAnthropicCrewAIAdapter:
    """Adapt TealAnthropic to CrewAI's LLM .call(messages) -> str protocol."""

    def __init__(
        self,
        teal_anthropic: TealAnthropic,
        model: str,
        cost_tracker: CostTracker,
        storage: InMemoryCostStorage,
        agent_id: str,
        max_tokens: int = 1024,
    ):
        self._client = teal_anthropic
        self._model = model
        self._tracker = cost_tracker
        self._storage = storage
        self._agent_id = agent_id
        self._max_tokens = max_tokens

    async def _call_async(self, messages: List[Dict[str, str]]) -> str:
        response = await self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            messages=messages,
        )
        usage = getattr(response, "usage", None)
        if usage is not None:
            record = self._tracker.calculate_actual_cost(
                request_id=getattr(response, "id", "crewai-req"),
                agent_id=self._agent_id,
                model=self._model,
                usage={
                    "input_tokens": getattr(usage, "input_tokens", 0),
                    "output_tokens": getattr(usage, "output_tokens", 0),
                    "total_tokens": getattr(usage, "input_tokens", 0)
                    + getattr(usage, "output_tokens", 0),
                },
                provider="anthropic",
            )
            await self._storage.store(record)
        return response.content[0].text

    def call(self, messages: List[Dict[str, str]], **_: Any) -> str:
        return asyncio.run(self._call_async(messages))


async def main() -> None:
    # 4. Shared infrastructure: one TealTiger guard, one cost tracker, one
    #    storage. Every tool call and every LLM call funnels through these,
    #    so per-agent and crew-total queries both work off the same data.
    guard = TealTiger(
        api_key=os.getenv("TEALTIGER_API_KEY", "demo-key"),
        ssa_url=os.getenv("TEALTIGER_SSA_URL", "http://localhost:3000"),
        policy=build_crew_policy(),
    )
    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(CostTrackerConfig(
        enabled=True,
        persist_records=True,
        enable_budgets=True,
        enable_alerts=True,
    ))

    # 5. Crew-wide budget. Multi-agent workflows fan out fast; a $5/day cap
    #    with alerts at 50/75/90% catches runaway crews before they bill.
    budget_manager = BudgetManager(storage)
    budget_manager.create_budget(BudgetConfig(
        name="Research Crew Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="alert",
        enabled=True,
    ))

    # 6. Two agents, each with its own agent_id so cost queries can split by
    #    role. They share the tool guard and cost tracker.
    researcher_id = "agent-researcher"
    writer_id = "agent-writer"

    researcher_llm = TealAnthropicCrewAIAdapter(
        teal_anthropic=TealAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY", "demo-anthropic-key"),
            agent_id=researcher_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
        ),
        model="claude-3-5-sonnet-20241022",
        cost_tracker=cost_tracker,
        storage=storage,
        agent_id=researcher_id,
    )
    writer_llm = TealAnthropicCrewAIAdapter(
        teal_anthropic=TealAnthropic(
            api_key=os.getenv("ANTHROPIC_API_KEY", "demo-anthropic-key"),
            agent_id=writer_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
        ),
        model="claude-3-5-sonnet-20241022",
        cost_tracker=cost_tracker,
        storage=storage,
        agent_id=writer_id,
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

    # 7. A trivial crew. The point of the example is the governance
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

    # 8. Run the crew. Network calls are stubbed unless ANTHROPIC_API_KEY is
    #    set; the governance code paths execute either way.
    result = crew.kickoff()
    print("Crew output:\n", result)

    # 9. Cost summary across all agents in the crew.
    print("\n=== Per-agent cost ===")
    for agent_id in (researcher_id, writer_id):
        records = await storage.get_by_agent_id(agent_id)
        total = sum(r.actual_cost for r in records)
        print(f"  {agent_id}: {len(records)} call(s), ${total:.6f}")


if __name__ == "__main__":
    asyncio.run(main())
