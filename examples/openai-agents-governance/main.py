"""
TealTiger + OpenAI Agents SDK governance example.

This example shows where to place TealTiger checks in a multi-agent OpenAI
Agents SDK workflow:

    1. Before each tool call, TealTiger evaluates whether the active agent is
       allowed to use the requested tool.
    2. Before an agent handoff, the shared session budget is checked.
    3. On agent output, TealTiger guardrails check for PII and unsafe content.

The script uses an in-process TealTiger policy evaluator by default so it can
run as a deterministic demo without a live Security Sidecar Agent or OpenAI API
key. Set TEALTIGER_SSA_URL and TEALTIGER_API_KEY to send the same tool
evaluations to a live TealTiger sidecar.
"""

import asyncio
import os
from dataclasses import dataclass
from typing import Any, Callable, Dict

try:
    from agents import (  # type: ignore[import-untyped]
        Agent,
        GuardrailFunctionOutput,
        RunContextWrapper,
        function_tool,
        output_guardrail,
    )
except ImportError as exc:  # pragma: no cover - setup guidance for example users
    raise SystemExit(
        "OpenAI Agents SDK is required for this example. Install it with "
        "`pip install 'openai-agents>=0.17' 'tealtiger==1.3.0'`."
    ) from exc

from tealtiger import (  # type: ignore[import-untyped]
    BudgetManager,
    ContentModerationGuardrail,
    CostTracker,
    CostTrackerConfig,
    GuardrailEngine,
    InMemoryCostStorage,
    PIIDetectionGuardrail,
    PolicyBuilder,
    SecurityDecision,
    TealTiger,
    TokenUsage,
)


SESSION_ID = "openai-agents-governance-demo"
DEMO_MODEL = "gpt-4-turbo"
SESSION_BUDGET_USD = 0.006


def run_async(coro):
    """Run SDK async helpers from this synchronous demo."""
    return asyncio.run(coro)


def build_policy():
    """Build the policy used by the local demo and optional live SSA mode."""
    return (
        PolicyBuilder()
        .name("openai-agents-governance-demo")
        .description("Allow low-risk support tools and deny sensitive actions")
        .add_rule(
            condition={"tool_name": "lookup_order"},
            action="allow",
            reason="Order lookup is allowed for support triage",
        )
        .add_rule(
            condition={"tool_name": "schedule_followup"},
            action="allow",
            reason="Follow-up scheduling is allowed for specialist agents",
        )
        .add_rule(
            condition={"tool_name": "refund_payment"},
            action="deny",
            reason="Refunds require human approval",
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
            agent_id=SESSION_ID,
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


def build_output_guardrails() -> GuardrailEngine:
    """Create output guardrails for PII and local content moderation."""
    engine = GuardrailEngine(parallel_execution=False, continue_on_error=True)
    engine.register_guardrail(
        PIIDetectionGuardrail(
            {
                "action": "block",
                "detect_types": ["email", "phone", "ssn", "credit_card"],
            }
        )
    )
    engine.register_guardrail(
        ContentModerationGuardrail({"use_openai": False, "action": "block"})
    )
    return engine


@dataclass
class GovernanceSession:
    """Shared governance state for one OpenAI Agents SDK session."""

    guard: TealTiger
    output_guardrails: GuardrailEngine
    cost_tracker: CostTracker
    storage: InMemoryCostStorage
    budget_manager: BudgetManager
    budget_id: str

    def execute_tool(
        self,
        agent_id: str,
        tool_name: str,
        parameters: Dict[str, Any],
        executor: Callable[[Dict[str, Any]], str],
    ) -> str:
        """Evaluate a tool call with TealTiger before executing it."""
        result = self.guard.execute_tool_sync(
            tool_name=tool_name,
            parameters=parameters,
            context={
                "session_id": SESSION_ID,
                "agent_id": agent_id,
                "framework": "openai-agents",
                "governance_point": "before_tool_call",
            },
            executor=lambda _tool_name, tool_parameters: executor(tool_parameters),
        )
        if not result.success:
            return "[blocked by TealTiger: {0}]".format(result.error)
        return str(result.data)

    def record_model_cost(
        self,
        agent_id: str,
        request_id: str,
        input_tokens: int,
        output_tokens: int,
    ) -> float:
        """Record deterministic token usage for budget enforcement."""
        token_usage = TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )
        record = self.cost_tracker.calculate_actual_cost(
            request_id=request_id,
            agent_id=agent_id,
            model=DEMO_MODEL,
            actual_tokens=token_usage,
            provider="openai",
            metadata={"framework": "openai-agents", "session_id": SESSION_ID},
        )
        # BudgetManager currently queries naive UTC windows, so keep the demo
        # record timestamp in the same shape before handing it to storage.
        record = record.model_copy(update={"timestamp": record.timestamp.replace("+00:00", "")})
        run_async(self.storage.store(record))
        run_async(self.budget_manager.record_cost(record))
        return record.actual_cost

    def check_handoff(
        self,
        from_agent: str,
        to_agent: str,
        estimated_cost: float,
    ) -> str:
        """Enforce the shared session budget before an agent handoff."""
        result = run_async(self.budget_manager.check_budget(to_agent, estimated_cost))
        if result.allowed:
            return "handoff allowed: {0} -> {1}".format(from_agent, to_agent)

        budget_name = result.blocked_by.name if result.blocked_by else "session budget"
        return "handoff blocked: {0} -> {1} would exceed {2}".format(
            from_agent,
            to_agent,
            budget_name,
        )

    def check_output(self, agent_id: str, output_text: str) -> str:
        """Run TealTiger guardrails against an agent response."""
        result = run_async(
            self.output_guardrails.execute(
                {"text": output_text},
                {
                    "session_id": SESSION_ID,
                    "agent_id": agent_id,
                    "framework": "openai-agents",
                    "governance_point": "on_output",
                },
            )
        )
        if result.passed:
            return "output allowed: no guardrail violations"
        return "output blocked: {0}".format(", ".join(result.failed_guardrails))

    def total_spend(self) -> float:
        return sum(record.actual_cost for record in self.storage.records.values())


def build_session() -> GovernanceSession:
    policy = build_policy()
    guard = build_guard(policy)
    storage = InMemoryCostStorage()
    budget_manager = BudgetManager(storage)
    budget = budget_manager.create_budget(
        name="OpenAI Agents demo session budget",
        limit=SESSION_BUDGET_USD,
        period="total",
        alert_thresholds=[75, 100],
        action="block",
    )
    return GovernanceSession(
        guard=guard,
        output_guardrails=build_output_guardrails(),
        cost_tracker=CostTracker(
            CostTrackerConfig(
                enabled=True,
                persist_records=True,
                enable_budgets=True,
                enable_alerts=True,
            )
        ),
        storage=storage,
        budget_manager=budget_manager,
        budget_id=budget.id,
    )


session = build_session()


def lookup_order(order_id: str) -> str:
    """Look up a support order by ID."""
    return session.execute_tool(
        agent_id="agent-triage",
        tool_name="lookup_order",
        parameters={"order_id": order_id},
        executor=lambda params: "Order {0}: delayed in fulfillment queue".format(
            params["order_id"]
        ),
    )


def refund_payment(order_id: str, amount_usd: float) -> str:
    """Attempt to refund an order payment."""
    return session.execute_tool(
        agent_id="agent-billing",
        tool_name="refund_payment",
        parameters={"order_id": order_id, "amount_usd": amount_usd},
        executor=lambda params: "Refunded ${0:.2f} for {1}".format(
            params["amount_usd"],
            params["order_id"],
        ),
    )


def schedule_followup(order_id: str, queue: str) -> str:
    """Schedule a follow-up for a support queue."""
    return session.execute_tool(
        agent_id="agent-support",
        tool_name="schedule_followup",
        parameters={"order_id": order_id, "queue": queue},
        executor=lambda params: "Follow-up scheduled for {0} in {1}".format(
            params["order_id"],
            params["queue"],
        ),
    )


lookup_order_tool = function_tool(
    lookup_order,
    name_override="lookup_order",
    description_override="Look up a support order after TealTiger policy approval.",
)
refund_payment_tool = function_tool(
    refund_payment,
    name_override="refund_payment",
    description_override="Attempt a payment refund after TealTiger policy approval.",
)
schedule_followup_tool = function_tool(
    schedule_followup,
    name_override="schedule_followup",
    description_override="Schedule support follow-up after TealTiger policy approval.",
)


@output_guardrail(name="tealtiger_output_guardrails")
def tealtiger_output_guardrails(
    context: RunContextWrapper[Any],
    agent: Agent[Any],
    output: Any,
) -> GuardrailFunctionOutput:
    """OpenAI Agents SDK output guardrail backed by TealTiger guardrails."""
    del context
    result = run_async(
        session.output_guardrails.execute(
            {"text": str(output)},
            {
                "session_id": SESSION_ID,
                "agent_id": agent.name,
                "framework": "openai-agents",
                "governance_point": "on_output",
            },
        )
    )
    return GuardrailFunctionOutput(
        output_info=result.get_summary(),
        tripwire_triggered=not result.passed,
    )


billing_agent = Agent(
    name="Billing specialist",
    handoff_description="Handles billing questions that may require human approval.",
    instructions="Resolve billing issues, but do not refund without policy approval.",
    tools=[refund_payment_tool],
    output_guardrails=[tealtiger_output_guardrails],
)

support_agent = Agent(
    name="Support specialist",
    handoff_description="Handles non-billing customer support follow-up.",
    instructions="Resolve support issues with approved follow-up tools.",
    tools=[schedule_followup_tool],
    output_guardrails=[tealtiger_output_guardrails],
)

triage_agent = Agent(
    name="Triage agent",
    instructions=(
        "Classify the customer request, look up safe order context, and hand off "
        "to the right specialist only when the shared budget allows it."
    ),
    tools=[lookup_order_tool],
    handoffs=[billing_agent, support_agent],
    output_guardrails=[tealtiger_output_guardrails],
)


def print_agents() -> None:
    print("=== OpenAI Agents SDK setup ===")
    print("Triage agent: {0}".format(triage_agent.name))
    print(
        "Handoffs: {0}".format(
            ", ".join(agent.name for agent in triage_agent.handoffs)
        )
    )
    print(
        "Tools: {0}".format(
            ", ".join(tool.name for tool in triage_agent.tools)
        )
    )
    print()


def print_budget() -> None:
    status = run_async(session.budget_manager.get_budget_status(session.budget_id))
    if not status:
        print("Budget status unavailable")
        return

    print(
        "Session spend: ${0:.6f} of ${1:.6f}".format(
            status.current_spending,
            status.budget.limit,
        )
    )


def run_demo() -> None:
    print_agents()

    print("=== Before tool call ===")
    print("triage/lookup_order -> {0}".format(lookup_order("ORD-1001")))
    session.record_model_cost("agent-triage", "triage-turn-1", 160, 80)
    print("billing/refund_payment -> {0}".format(refund_payment("ORD-1001", 39.99)))
    print()

    print("=== Before handoff ===")
    print(session.check_handoff("agent-triage", "agent-billing", estimated_cost=0.0002))
    session.record_model_cost("agent-billing", "billing-turn-1", 700, 300)
    print(session.check_handoff("agent-billing", "agent-support", estimated_cost=0.0002))
    print_budget()
    print()

    print("=== Specialist allowed tool ===")
    print(
        "support/schedule_followup -> {0}".format(
            schedule_followup("ORD-1001", "fulfillment")
        )
    )
    print()

    print("=== On output ===")
    safe_output = "I found the fulfillment delay and scheduled a follow-up."
    pii_output = "Customer email is jordan@example.com and phone is 212-555-0199."
    print("safe output -> {0}".format(session.check_output("agent-support", safe_output)))
    print("PII output -> {0}".format(session.check_output("agent-support", pii_output)))
    print()

    print("=== TealTiger tool statistics ===")
    print(session.guard.get_statistics())


def main() -> None:
    try:
        run_demo()
    finally:
        session.guard.close_sync()


if __name__ == "__main__":
    main()
