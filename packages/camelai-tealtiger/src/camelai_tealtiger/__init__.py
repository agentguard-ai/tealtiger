"""TealTiger Agent Hook for CAMEL-AI.

Add deterministic governance to any CAMEL-AI multi-agent system:

    from camelai_tealtiger import TealTigerAgentHook

    hook = TealTigerAgentHook()

    # Before each agent step
    decision = hook.pre_step(
        agent_id="assistant-001",
        step_content="Summarize this document...",
        tool_name="search",
        tool_args={"query": "latest news"},
    )

    # After each agent step
    hook.post_step(
        agent_id="assistant-001",
        step_result="Here is the summary...",
        token_usage={"prompt_tokens": 150, "completion_tokens": 80},
    )

    # Zero-config mode: observe everything, allow all, track cost, detect PII
    # Policy mode with TealEngine:
    from tealtiger import TealEngine

    engine = TealEngine(policies=[...])
    hook = TealTigerAgentHook(engine=engine, mode="ENFORCE")

No LLM in the governance path. All policy evaluation is deterministic, adding <2ms latency.
"""

from camelai_tealtiger.agent_hook import (
    AgentSummary,
    AuditEntry,
    BaselineEntry,
    GovernanceAction,
    GovernanceDenyError,
    GovernanceMode,
    PIIFinding,
    TealTigerAgentHook,
)

__all__ = [
    "TealTigerAgentHook",
    "GovernanceDenyError",
    "GovernanceAction",
    "GovernanceMode",
    "AuditEntry",
    "PIIFinding",
    "AgentSummary",
    "BaselineEntry",
]
