"""
TealTiger + CrewAI governance example.

This example runs a two-agent CrewAI workflow with TealTiger governance around
each tool call. It also records deterministic cost entries per agent so the
cost summary is visible without requiring a live LLM provider.

Run from the repository root with:

    python examples/crewai-governance/main.py

The default mode uses an in-process TealTiger policy evaluator for a repeatable
demo. Set TEALTIGER_SSA_URL and TEALTIGER_API_KEY to send the same tool
evaluations to a live TealTiger Security Sidecar Agent instead.
"""

import ast
import asyncio
import operator
import os
from typing import Any, Callable, Dict, List

os.environ.setdefault("CREWAI_TRACING_ENABLED", "false")
os.environ.setdefault("OTEL_SDK_DISABLED", "true")

try:
    from crewai import Agent, BaseLLM, Crew, Task  # type: ignore[import-untyped]
    from crewai.tools import BaseTool  # type: ignore[import-untyped]
except ImportError as exc:  # pragma: no cover - setup guidance for example users
    raise SystemExit(
        "CrewAI is required for this example. Install it with "
        "`pip install 'crewai>=1.0' 'tealtiger==1.3.0'`."
    ) from exc

from tealtiger import (  # type: ignore[import-untyped]
    CostTracker,
    CostTrackerConfig,
    InMemoryCostStorage,
    PolicyBuilder,
    SecurityDecision,
    TealTiger,
    TokenUsage,
)


DEMO_MODEL = "claude-3-haiku-20240307"
SESSION_ID = "crewai-governance-demo"


def build_crew_policy():
    """Build the policy used by both the local demo and the live SSA mode."""
    return (
        PolicyBuilder()
        .name("crewai-governance-demo")
        .description("Allow low-risk research tools and block customer exports")
        .add_rule(
            condition={"tool_name": "public_research"},
            action="allow",
            reason="Public research is allowed for the researcher agent",
        )
        .add_rule(
            condition={"tool_name": "calculator"},
            action="allow",
            reason="Deterministic calculations are allowed for the writer agent",
        )
        .add_rule(
            condition={"tool_name": "customer_export"},
            action="deny",
            reason="Customer exports require human approval",
        )
        .add_rule(
            condition={"tool_name": "*"},
            action="deny",
            reason="Default deny: tools must be explicitly allowlisted",
        )
        .build()
    )


class LocalPolicyTealTiger(TealTiger):
    """
    TealTiger client variant that evaluates the example policy locally.

    Use this for a deterministic example that runs without a sidecar. In
    production, use the base TealTiger client with TEALTIGER_SSA_URL and deploy
    the same policy to the sidecar.
    """

    def __init__(self, policy) -> None:
        super().__init__(
            api_key="local-demo-key",
            ssa_url="http://localhost:3000",
            agent_id="crewai-governance-demo",
            max_retries=0,
        )
        self._policy = policy

    def _evaluate_security_sync(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        context: Dict[str, Any],
    ) -> SecurityDecision:
        del parameters, context
        for rule in self._policy.rules:
            expected_tool = rule.get("condition", {}).get("tool_name")
            if expected_tool in (tool_name, "*"):
                action = rule["action"]
                return SecurityDecision(
                    allowed=action == "allow",
                    reason=rule["reason"],
                    policy_id=self._policy.id,
                    transformed=False,
                )

        return SecurityDecision(
            allowed=False,
            reason="No matching policy rule",
            policy_id=self._policy.id,
            transformed=False,
        )


def build_guard(policy) -> TealTiger:
    """Use a live SSA when configured, otherwise run the local policy demo."""
    ssa_url = os.getenv("TEALTIGER_SSA_URL")
    api_key = os.getenv("TEALTIGER_API_KEY")
    if ssa_url and api_key:
        return TealTiger(api_key=api_key, ssa_url=ssa_url, agent_id=SESSION_ID)
    return LocalPolicyTealTiger(policy)


def governed_tool_call(
    guard: TealTiger,
    tool_name: str,
    agent_id: str,
    parameters: Dict[str, Any],
    executor: Callable[[Dict[str, Any]], str],
) -> str:
    """Run a CrewAI tool through TealTiger before executing it."""

    result = guard.execute_tool_sync(
        tool_name=tool_name,
        parameters=parameters,
        context={
            "session_id": SESSION_ID,
            "agent_id": agent_id,
            "workflow": "crewai",
        },
        executor=lambda _tool_name, tool_parameters: executor(tool_parameters),
    )
    if not result.success:
        return "[blocked by TealTiger: {0}]".format(result.error)
    return str(result.data)


class PublicResearchTool(BaseTool):
    name: str = "public_research"
    description: str = "Search public documentation and return short notes"

    def __init__(self, guard: TealTiger, agent_id: str) -> None:
        super().__init__()
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, query: str) -> str:
        return governed_tool_call(
            self._guard,
            self.name,
            self._agent_id,
            {"query": query},
            lambda params: (
                "Public research notes for '{0}': CrewAI coordinates agents, "
                "TealTiger evaluates tool actions, and cost records can be "
                "grouped by agent_id."
            ).format(params["query"]),
        )


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
_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
_UNARY_OPERATORS = {
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def safe_arithmetic(expression: str) -> str:
    tree = ast.parse(expression, mode="eval")
    for node in ast.walk(tree):
        if not isinstance(node, _ARITH_NODES):
            raise ValueError("unsupported syntax: {0}".format(type(node).__name__))
        if isinstance(node, ast.Constant) and not isinstance(node.value, (int, float)):
            raise ValueError("unsupported constant: {0!r}".format(node.value))
    return str(evaluate_arithmetic_node(tree.body))


def evaluate_arithmetic_node(node) -> float:
    if isinstance(node, ast.Constant):
        return node.value
    if isinstance(node, ast.BinOp):
        operation = _BINARY_OPERATORS[type(node.op)]
        return operation(
            evaluate_arithmetic_node(node.left),
            evaluate_arithmetic_node(node.right),
        )
    if isinstance(node, ast.UnaryOp):
        operation = _UNARY_OPERATORS[type(node.op)]
        return operation(evaluate_arithmetic_node(node.operand))
    raise ValueError("unsupported syntax: {0}".format(type(node).__name__))


class CalculatorTool(BaseTool):
    name: str = "calculator"
    description: str = "Evaluate a deterministic arithmetic expression"

    def __init__(self, guard: TealTiger, agent_id: str) -> None:
        super().__init__()
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, expression: str) -> str:
        return governed_tool_call(
            self._guard,
            self.name,
            self._agent_id,
            {"expression": expression},
            lambda params: safe_arithmetic(params["expression"]),
        )


class CustomerExportTool(BaseTool):
    name: str = "customer_export"
    description: str = "Export customer records to an external location"

    def __init__(self, guard: TealTiger, agent_id: str) -> None:
        super().__init__()
        self._guard = guard
        self._agent_id = agent_id

    def _run(self, dataset: str) -> str:
        return governed_tool_call(
            self._guard,
            self.name,
            self._agent_id,
            {"dataset": dataset},
            lambda params: "Exported customer dataset {0}".format(params["dataset"]),
        )


def run_async(coro):
    return asyncio.run(coro)


def message_text(messages) -> str:
    if isinstance(messages, str):
        return messages
    parts: List[str] = []
    for message in messages:
        if isinstance(message, dict):
            parts.append(str(message.get("content", "")))
        else:
            parts.append(str(message))
    return "\n".join(parts)


class CostRecordingDemoLLM(BaseLLM):
    """Deterministic CrewAI LLM that records costs through TealTiger."""

    def __init__(
        self,
        agent_id: str,
        responses: List[str],
        cost_tracker: CostTracker,
        cost_storage: InMemoryCostStorage,
    ) -> None:
        super().__init__(model=DEMO_MODEL)
        self.__dict__["_agent_id"] = agent_id
        self.__dict__["_responses"] = responses
        self.__dict__["_cost_tracker"] = cost_tracker
        self.__dict__["_cost_storage"] = cost_storage
        self.__dict__["_call_count"] = 0

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
        del tools, callbacks, available_functions, from_task, from_agent, response_model
        prompt = message_text(messages)
        response = self._responses[min(self._call_count, len(self._responses) - 1)]
        self._call_count += 1

        token_usage = TokenUsage(
            input_tokens=max(1, len(prompt.split())),
            output_tokens=max(1, len(response.split())),
            total_tokens=max(2, len(prompt.split()) + len(response.split())),
        )
        estimate = self._cost_tracker.estimate_cost(
            model=self.model,
            estimated_tokens=token_usage,
            provider="anthropic",
        )

        cost_record = self._cost_tracker.calculate_actual_cost(
            request_id="{0}-{1}".format(self._agent_id, self._call_count),
            agent_id=self._agent_id,
            model=self.model,
            actual_tokens=token_usage,
            provider="anthropic",
            metadata={"framework": "crewai", "demo": True},
        )
        run_async(self._cost_storage.store(cost_record))
        print(
            "Cost estimate for {0}: ${1:.6f}".format(
                self._agent_id,
                estimate.estimated_cost,
            )
        )
        return response


def print_policy(policy) -> None:
    print("=== Policy ===")
    print("{0}: {1}".format(policy.name, policy.description))
    for rule in policy.rules:
        condition = rule.get("condition", {})
        print(
            "- {0} {1}: {2}".format(
                rule["action"].upper(),
                condition.get("tool_name", "*"),
                rule["reason"],
            )
        )
    print()


def demonstrate_governed_tools(
    research_tool: PublicResearchTool,
    calculator_tool: CalculatorTool,
    export_tool: CustomerExportTool,
) -> None:
    print("=== Governed CrewAI tool calls ===")
    print(
        "researcher/public_research -> {0}".format(
            research_tool._run("AI agent governance")
        )
    )
    print("writer/calculator -> {0}".format(calculator_tool._run("(42 * 3) + 7")))
    print("writer/customer_export -> {0}".format(export_tool._run("customers.csv")))
    print()


def print_cost_summary(
    storage: InMemoryCostStorage,
    agent_ids: List[str],
) -> None:
    print("=== Per-agent cost ===")
    for agent_id in agent_ids:
        records = run_async(storage.get_by_agent_id(agent_id))
        total_cost = sum(record.actual_cost for record in records)
        total_tokens = sum(record.actual_tokens.total_tokens for record in records)
        print(
            "{0}: {1} call(s), {2} token(s), ${3:.6f}".format(
                agent_id,
                len(records),
                total_tokens,
                total_cost,
            )
        )


def main() -> None:
    policy = build_crew_policy()
    guard = build_guard(policy)

    storage = InMemoryCostStorage()
    cost_tracker = CostTracker(
        CostTrackerConfig(
            enabled=True,
            persist_records=True,
            enable_budgets=False,
            enable_alerts=False,
        )
    )

    researcher_id = "agent-researcher"
    writer_id = "agent-writer"

    research_tool = PublicResearchTool(guard, researcher_id)
    calculator_tool = CalculatorTool(guard, writer_id)
    export_tool = CustomerExportTool(guard, writer_id)

    researcher = Agent(
        role="Researcher",
        goal="Collect public notes about AI governance for a short brief",
        backstory="A careful researcher who only uses approved public sources.",
        tools=[research_tool],
        llm=CostRecordingDemoLLM(
            agent_id=researcher_id,
            responses=[
                "Final Answer: Public research suggests that agent governance "
                "needs policy checks, auditable tool calls, and cost attribution."
            ],
            cost_tracker=cost_tracker,
            cost_storage=storage,
        ),
        verbose=False,
        allow_delegation=False,
    )

    writer = Agent(
        role="Writer",
        goal="Turn research notes into a concise governance summary",
        backstory="A concise writer who uses math tools but cannot export customer data.",
        tools=[calculator_tool, export_tool],
        llm=CostRecordingDemoLLM(
            agent_id=writer_id,
            responses=[
                "Final Answer: TealTiger governance places an allowlist in front "
                "of CrewAI tool use, records cost by agent_id, and blocks risky "
                "actions such as customer exports."
            ],
            cost_tracker=cost_tracker,
            cost_storage=storage,
        ),
        verbose=False,
        allow_delegation=False,
    )

    research_task = Task(
        description="Research how TealTiger can govern a CrewAI workflow.",
        expected_output="Three concise governance observations.",
        agent=researcher,
    )
    writing_task = Task(
        description="Write a two-sentence summary using the research notes.",
        expected_output="Two concise sentences.",
        agent=writer,
        context=[research_task],
    )
    crew = Crew(agents=[researcher, writer], tasks=[research_task, writing_task])

    try:
        print_policy(policy)
        demonstrate_governed_tools(research_tool, calculator_tool, export_tool)

        print("=== CrewAI result ===")
        result = crew.kickoff()
        print(result)
        print()

        print_cost_summary(storage, [researcher_id, writer_id])
    finally:
        guard.close_sync()


if __name__ == "__main__":
    main()
