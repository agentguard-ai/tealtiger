"""
TealTiger + CrewAI Integration

Shows how to add TealTiger governance to a multi-agent CrewAI workflow:

    1. Tool allowlisting: every CrewAI tool call routes through
       TealTiger.execute_tool_sync(), which evaluates the policy that
       has been deployed to the Security Sidecar Agent (SSA). The
       example authors that policy with PolicyBuilder so the rules are
       visible in the same file.
    2. Cost tracking: a single CostTracker + InMemoryCostStorage is
       shared across every agent in the crew. Each Agent has its own
       agent_id, so per-agent totals and crew-wide totals both come
       from the same data.
    3. LLM wrapping: TealAnthropic plugs into CrewAI through a
       BaseLLM subclass. CrewAI calls llm.call(messages); the subclass
       forwards to TealAnthropic.messages.create() (async) and lets
       TealAnthropic record cost internally.

Run with:

    pip install 'crewai>=1.0'
    ANTHROPIC_API_KEY=sk-ant-...      # required for live LLM calls
    TEALTIGER_SSA_URL=http://...      # required for tool allowlist
    TEALTIGER_API_KEY=...
    python examples/python/crewai_integration.py

CrewAI-specific notes this example demonstrates:
    - CrewAI tools subclass BaseTool and implement _run; that is where
      the TealTiger allowlist hook belongs. Each tool declares its
      arguments by typing _run; **kwargs would drop the schema.
    - CrewAI's Agent rejects arbitrary llm objects unless they are
      strings or BaseLLM instances, so the adapter subclasses BaseLLM.
    - The TealTiger policy is enforced by the SSA, not by the local
      client. Deploy build_crew_policy() to your SSA before running.
"""

import ast
import asyncio
import os
from typing import Any, Dict, List, Optional

from crewai import Agent, BaseLLM, Crew, Task  # type: ignore[import-untyped]
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

# 1. Pricing-table model. CostTracker only attributes spend to model IDs
#    in MODEL_PRICING; using an unlisted ID silently records $0 and the
#    crew-wide budget never trips. claude-3-haiku-20240307 is in the
#    table and small enough for a multi-agent demo.
DEMO_MODEL = "claude-3-haiku-20240307"


# 2. Policy authored locally so the rules are visible in this file.
#    Deploy the resulting Policy to your SSA so
#    TealTiger.execute_tool_sync() can enforce it. Anything not matched
#    falls through to the default deny.
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


# 3. Guarded tools. Every CrewAI tool _run() routes through TealTiger
#    first. A deny short-circuits the tool with a clear error; the
#    agent then sees the failure in its scratchpad and either tries
#    another tool or stops. Each subclass declares its own typed
#    _run() so CrewAI can derive the args_schema from the signature.
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


# Safe arithmetic evaluator. ast.literal_eval only handles literals,
# so 2+2 would raise; here we walk the AST and reject anything that
# isn't a number or one of the binary/unary operators below.
_ARITH_NODES = (
    ast.Expression,
    ast.BinOp, ast.UnaryOp, ast.Constant,
    ast.Add, ast.Sub, ast.Mult, ast.Div, ast.FloorDiv, ast.Mod, ast.Pow,
    ast.USub, ast.UAdd,
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


# 4. LLM adapter. CrewAI's Agent only accepts strings or BaseLLM
#    instances, so the wrapper subclasses BaseLLM. CrewAI calls
#    .call(messages) synchronously; we bridge that to TealAnthropic's
#    async API. main() is synchronous so asyncio.run() here doesn't
#    nest inside a running loop.
class TealAnthropicLLM(BaseLLM):
    """Subclass of CrewAI's BaseLLM that delegates to TealAnthropic."""

    def __init__(self, teal_anthropic: TealAnthropic, model: str, max_tokens: int = 1024):
        super().__init__(model=model)
        # Pydantic model — keep the runtime-only attributes off the
        # validator path by setting them on the underlying dict.
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
        # MessageCreateResponse.content is List[Dict[str, Any]] in the
        # SDK, not Anthropic's content-block objects.
        return response.content[0]["text"]


def main() -> None:
    # 5. Shared infrastructure: one TealTiger guard for tool calls, one
    #    cost tracker, and one storage. Every tool call and every LLM
    #    call funnels through these so per-agent and crew-total queries
    #    both work off the same data.
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

    # 6. Crew-wide budget. action="block" is what enforces the cap;
    #    "alert" only emits warnings and still returns allowed=True.
    #    Alert thresholds at 50/75/90 fire on the way to the cap.
    budget_manager = BudgetManager(storage)
    budget_manager.create_budget(
        name="Research Crew Daily Budget",
        limit=5.0,
        period="daily",
        alert_thresholds=[50, 75, 90],
        action="block",
        enabled=True,
    )

    # 7. Policy is authored here and is expected to already be deployed
    #    to the SSA at TEALTIGER_SSA_URL. We log it once on startup so
    #    the rules show up in the example's output.
    policy = build_crew_policy()
    print(f"Loaded policy '{policy.name}' with {len(policy.rules)} rule(s)")
    for rule in policy.rules:
        print(f"  {rule['action'].upper()}: {rule['reason']}")
    print()

    # 8. Two agents, each tagged with its own agent_id. They share the
    #    tool guard, the cost tracker, and the storage.
    researcher_id = "agent-researcher"
    writer_id = "agent-writer"
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "demo-anthropic-key")

    researcher_llm = TealAnthropicLLM(
        teal_anthropic=TealAnthropic(TealAnthropicConfig(
            api_key=anthropic_key,
            agent_id=researcher_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
            budget_manager=budget_manager,
        )),
        model=DEMO_MODEL,
    )
    writer_llm = TealAnthropicLLM(
        teal_anthropic=TealAnthropic(TealAnthropicConfig(
            api_key=anthropic_key,
            agent_id=writer_id,
            cost_tracker=cost_tracker,
            cost_storage=storage,
            budget_manager=budget_manager,
        )),
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

    # 9. A trivial crew. The point of this example is the governance
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

    # 10. Run the crew. Network calls are stubbed unless
    #     ANTHROPIC_API_KEY is set; the governance code paths execute
    #     either way.
    result = crew.kickoff()
    print("Crew output:\n", result)

    # 11. Cost summary across all agents in the crew. Records were
    #     written by TealAnthropic itself to the shared storage.
    print("\n=== Per-agent cost ===")
    for agent_id in (researcher_id, writer_id):
        records = asyncio.run(storage.get_by_agent_id(agent_id))
        total = sum(r.actual_cost for r in records)
        print(f"  {agent_id}: {len(records)} call(s), ${total:.6f}")


if __name__ == "__main__":
    main()
