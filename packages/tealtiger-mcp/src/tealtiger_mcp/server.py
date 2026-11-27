"""
TealTiger MCP Server

Exposes TealTiger guardrails, secret detection, cost tracking, and budget
enforcement as MCP tools for Claude Desktop, Cursor, Kiro, and any MCP
client.

Usage:
    tealtiger-mcp                  # stdio transport (default)
    tealtiger-mcp --transport sse  # SSE transport for remote access
"""

import asyncio
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from mcp.server.fastmcp import FastMCP
from tealtiger import (
    BudgetManager,
    ContentModerationGuardrail,
    CostTracker,
    CostTrackerConfig,
    GuardrailEngine,
    InMemoryCostStorage,
    PIIDetectionGuardrail,
    PromptInjectionGuardrail,
    TokenUsage,
    get_provider_models,
    get_supported_providers,
)
from tealtiger.core.engine import ModeConfig, PolicyMode, TealEngine

from tealtiger_mcp.secret_detection import SecretDetectionGuardrail

# ---------------------------------------------------------------------------
# Budget state
# ---------------------------------------------------------------------------

class _BudgetState:
    def __init__(self):
        self.lock = asyncio.Lock()
        self.storage = InMemoryCostStorage()
        self.manager = BudgetManager(self.storage)

        for period, name in (
            ("total", "TEALTIGER_MCP_SESSION_BUDGET_USD"),
            ("daily", "TEALTIGER_MCP_DAILY_BUDGET_USD"),
        ):
            raw = os.getenv(name)
            if raw is None:
                continue

            try:
                limit = float(raw)
            except ValueError as exc:
                raise ValueError(f"{name} must be a valid USD amount") from exc

            if not math.isfinite(limit) or limit <= 0:
                raise ValueError(f"{name} must be a positive finite USD amount")

            self.manager.create_budget(
                name=name,
                limit=limit,
                period=period,
                alert_thresholds=[],
                action="block"
            )

# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------

mcp = FastMCP(
    "TealTiger",
    instructions=(
        "Deterministic AI governance: PII detection, prompt injection blocking, "
        "content moderation, secret detection, cost estimation, and budget checks. "
        "All enforcement runs locally — no data leaves your process."
    ),
)

# ---------------------------------------------------------------------------
# Shared instances (lazy-initialized, reused across calls)
# ---------------------------------------------------------------------------

_pii_guardrail: PIIDetectionGuardrail | None = None
_injection_guardrail: PromptInjectionGuardrail | None = None
_moderation_guardrail: ContentModerationGuardrail | None = None
_secret_guardrail: SecretDetectionGuardrail | None = None
_engine: GuardrailEngine | None = None
_cost_tracker: CostTracker | None = None
_budget_state: _BudgetState | None = None


# ---------------------------------------------------------------------------
# Policy state
#
# The policy is read from a file named by TEALTIGER_MCP_POLICY_FILE, at server
# startup, and NEVER from a tool argument.
#
# That is a governance decision, not an ergonomic one. In an MCP deployment the
# client is the agent being governed. A tool that accepted a policy per call
# would let the governed party choose the rules it is judged by, which is not a
# flexible version of governance — it is the absence of governance wearing its
# shape. The same reasoning retired `PolicyTester.test_policy()` in the SDK's
# 1.5.0 and the silent-allow engine in 1.6.0.
#
# Policy authoring and simulation are a separate capability (G2 in the
# governance capability floor) and belong in separately named tools that cannot
# be mistaken for enforcement.
# ---------------------------------------------------------------------------

POLICY_FILE_ENV = "TEALTIGER_MCP_POLICY_FILE"


class _PolicyState:
    """The configured policy engine, or the reason there isn't one.

    Construction never raises. A broken policy must not stop `check_pii` from
    working, and the 12 tools that predate this one do not depend on it. The
    failure is carried instead, and surfaced two ways: `main()` refuses to start
    the server, and `evaluate_action` refuses to answer.

    What is never done is the third option — answering anyway. An ALLOW produced
    without a readable policy is the defect this package's SDK dependency spent
    two releases removing.
    """

    def __init__(self) -> None:
        self.engine: TealEngine | None = None
        self.error: str | None = None
        self.path: str | None = os.getenv(POLICY_FILE_ENV) or None

        if self.path is None:
            self.error = (
                f"No policy is configured. Set {POLICY_FILE_ENV} to a JSON file "
                "containing a TealTiger policy document, for example "
                '{"tools": {"search": {"allowed": true}}}.'
            )
            return

        try:
            raw = Path(self.path).read_text(encoding="utf-8")
        except OSError as exc:
            self.error = f"Cannot read the policy file at {self.path}: {exc}"
            return

        try:
            policies = json.loads(raw)
        except json.JSONDecodeError as exc:
            # JSON only, deliberately. The specification writes policy shapes in
            # YAML, but adding a parser — or leaning on one that happens to be
            # installed transitively — to read a governance policy is not a
            # trade worth making for a first release. Converting YAML to JSON is
            # one command; silently accepting a half-parsed policy is not.
            self.error = f"The policy file at {self.path} is not valid JSON: {exc}"
            return

        if not isinstance(policies, dict):
            self.error = (
                f"The policy file at {self.path} must contain a JSON object, got "
                f"{type(policies).__name__}."
            )
            return

        engine = TealEngine(policies=policies, mode=ModeConfig(default=PolicyMode.ENFORCE))

        # Refuse a policy this build cannot enforce, before answering anything
        # with it. Checked here rather than on first evaluation so the operator
        # learns at startup instead of on the request that mattered.
        unenforceable = engine.unenforceable_sections()
        if unenforceable:
            enforced = ", ".join(
                name for name, state in engine.rule_type_support().items()
                if state == "enforced"
            )
            self.error = (
                f"The policy at {self.path} configures rule types this build cannot "
                f"enforce: {', '.join(unenforceable)}. Enforced: {enforced}. "
                "Remove the unenforceable sections, or use the guardrail tools "
                "(check_pii, check_injection, check_content) for content governance."
            )
            return

        self.engine = engine


_policy_state: _PolicyState | None = None


def _get_policy_state() -> _PolicyState:
    global _policy_state
    if _policy_state is None:
        _policy_state = _PolicyState()
    return _policy_state


def _get_pii_guardrail() -> PIIDetectionGuardrail:
    global _pii_guardrail
    if _pii_guardrail is None:
        _pii_guardrail = PIIDetectionGuardrail({"action": "redact", "enabled": True})
    return _pii_guardrail


def _get_injection_guardrail() -> PromptInjectionGuardrail:
    global _injection_guardrail
    if _injection_guardrail is None:
        _injection_guardrail = PromptInjectionGuardrail({"action": "block", "enabled": True})
    return _injection_guardrail


def _get_moderation_guardrail() -> ContentModerationGuardrail:
    global _moderation_guardrail
    if _moderation_guardrail is None:
        _moderation_guardrail = ContentModerationGuardrail({"action": "block", "enabled": True})
    return _moderation_guardrail


def _get_secret_guardrail() -> SecretDetectionGuardrail:
    global _secret_guardrail
    if _secret_guardrail is None:
        _secret_guardrail = SecretDetectionGuardrail({"action": "block", "enabled": True})
    return _secret_guardrail


def _get_engine() -> GuardrailEngine:
    global _engine
    if _engine is None:
        _engine = GuardrailEngine()
        _engine.register_guardrail(_get_pii_guardrail())
        _engine.register_guardrail(_get_injection_guardrail())
        _engine.register_guardrail(_get_moderation_guardrail())
        _engine.register_guardrail(_get_secret_guardrail())
    return _engine


def _get_cost_tracker() -> CostTracker:
    global _cost_tracker
    if _cost_tracker is None:
        _cost_tracker = CostTracker(CostTrackerConfig(enabled=True))
    return _cost_tracker


# ---------------------------------------------------------------------------
# Tools — Guardrails
# ---------------------------------------------------------------------------


@mcp.tool()
async def check_pii(text: str) -> str:
    """Scan text for personally identifiable information (PII).

    Detects emails, phone numbers, SSNs, credit card numbers, and IP addresses
    using pure regex. Sub-millisecond, fully local, no data leaves your process.

    Returns JSON with: passed, action, risk_score, detections, and redacted_text.
    """
    guardrail = _get_pii_guardrail()
    result = await guardrail.evaluate(text)
    return json.dumps(result.model_dump(), indent=2, default=str)


@mcp.tool()
async def check_injection(text: str) -> str:
    """Scan text for prompt injection and jailbreak attempts.

    Detects instruction override, system prompt extraction, role manipulation,
    encoding attacks, and delimiter injection using local pattern matching.

    Returns JSON with: passed, action, risk_score, and detected patterns.
    """
    guardrail = _get_injection_guardrail()
    result = await guardrail.evaluate(text)
    return json.dumps(result.model_dump(), indent=2, default=str)


@mcp.tool()
async def check_content(text: str) -> str:
    """Scan text for content policy violations.

    Uses content moderation to detect harmful, violent, sexual, or
    otherwise policy-violating content.

    Returns JSON with: passed, action, risk_score, and flagged categories.
    """
    guardrail = _get_moderation_guardrail()
    result = await guardrail.evaluate(text)
    return json.dumps(result.model_dump(), indent=2, default=str)


@mcp.tool()
async def detect_secrets(text: str) -> str:
    """Scan text for leaked secrets and credentials.

    Detects API keys (OpenAI, AWS), GitHub PATs, Slack tokens, private keys,
    and other credential patterns using deterministic regex. Fully local —
    no data leaves your process.

    Returns JSON with: passed, action, risk_score, findings_count, findings
    (types, redacted matches, positions), and redacted_text.
    """
    guardrail = _get_secret_guardrail()
    result = await guardrail.evaluate(text)
    # Flatten metadata into the top-level response for client ergonomics
    dump = result.model_dump()
    metadata = dump.pop("metadata", {})
    dump.update(metadata)
    return json.dumps(dump, indent=2, default=str)


@mcp.tool()
async def evaluate_guardrails(text: str) -> str:
    """Run all guardrails (PII, injection, content, secrets) on the input text.

    This is the recommended tool for pre-flight checks before sending a prompt
    to an AI model. It runs all registered guardrails and returns a combined result.

    Returns JSON with: passed, max_risk_score, failed_guardrails, execution_time,
    and individual guardrail results.
    """
    engine = _get_engine()
    result = await engine.execute(text)
    return json.dumps(result.model_dump(), indent=2, default=str)


# ---------------------------------------------------------------------------
# Tools — Cost Tracking
# ---------------------------------------------------------------------------


@mcp.tool()
async def estimate_cost(
    model: str,
    input_tokens: int,
    output_tokens: int,
    provider: str = "openai",
) -> str:
    """Estimate the cost of an AI API call before making it.

    Supports 7 providers: openai, anthropic, google, azure-openai, bedrock,
    cohere, mistral. Covers 95%+ of the market.

    Args:
        model: Model identifier (e.g. "gpt-4", "claude-3-opus-20240229")
        input_tokens: Estimated input token count
        output_tokens: Estimated output token count
        provider: Provider name (default: "openai")

    Returns JSON with: estimated_cost, breakdown (input/output), model, provider.
    """
    tracker = _get_cost_tracker()
    tokens = TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )
    estimate = tracker.estimate_cost(model=model, estimated_tokens=tokens, provider=provider)
    return json.dumps(estimate.model_dump(), indent=2, default=str)


@mcp.tool()
async def compare_costs(
    models: list[str],
    input_tokens: int,
    output_tokens: int,
) -> str:
    """Compare costs across multiple models for the same token usage.

    Useful for choosing the most cost-effective model for a task.

    Args:
        models: List of "provider/model" strings (e.g. ["openai/gpt-4", "anthropic/claude-3-sonnet-20240229"])
        input_tokens: Input token count
        output_tokens: Output token count

    Returns JSON array of estimates sorted by cost (cheapest first).
    """
    tracker = _get_cost_tracker()
    tokens = TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )

    results = []
    for entry in models:
        if "/" in entry:
            provider, model = entry.split("/", 1)
        else:
            provider, model = "openai", entry

        estimate = tracker.estimate_cost(model=model, estimated_tokens=tokens, provider=provider)
        results.append({
            "model": model,
            "provider": provider,
            "estimated_cost": estimate.estimated_cost,
            "breakdown": estimate.breakdown.model_dump(),
        })

    results.sort(key=lambda r: r["estimated_cost"])
    return json.dumps(results, indent=2, default=str)


@mcp.tool()
async def check_budget(
    request_id: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    provider: str = "openai",
    agent_id: str = "mcp-client",
) -> str:
    """Record actual usage and report budgets; this does not block model calls.

    Retries are idempotent in this process; unknown prices keep the SDK fallback.
    """

    global _budget_state

    if not all(value.strip() for value in (request_id, agent_id, model, provider)):
        raise ValueError("Request, agent, model and provider must not be empty")
    if input_tokens < 0 or output_tokens < 0:
        raise ValueError("Token counts must be non-negative")
    if _budget_state is None:
        _budget_state = _BudgetState()

    state = _budget_state

    async with state.lock:
        usage = dict(
            model=model,
            provider=provider,
            input_tokens=input_tokens,
            output_tokens=output_tokens
        )
        records = await state.storage.get_by_request_id(request_id)
        record = next((r for r in records if r.agent_id == agent_id), None)
        duplicate = record is not None

        if duplicate and (record.metadata or {}).get("mcp_usage") != usage:
            raise ValueError("Conflicting usage for the same agent and request")
        if record is None:
            tokens = TokenUsage(
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                total_tokens=input_tokens + output_tokens
            )
            record = _get_cost_tracker().calculate_actual_cost(
                request_id=request_id,
                agent_id=agent_id,
                model=model,
                actual_tokens=tokens,
                provider=provider,
            )
            if not math.isfinite(record.actual_cost) or record.actual_cost < 0:
                raise ValueError("Calculated cost must be finite and non-negative")

            # The current SDK queries naive UTC windows.
            stamp = datetime.fromisoformat(record.timestamp.strip().replace("Z", "+00:00"))
            if stamp.utcoffset() is None:
                raise ValueError("SDK cost timestamp must include a timezone")
            record = record.model_copy(
                update={
                    "timestamp": stamp.astimezone(timezone.utc).replace(tzinfo=None).isoformat(),
                    "metadata": {**(record.metadata or {}), "mcp_usage": usage},
                }
            )
        try:
            if not duplicate:
                await state.storage.store(record)
            statuses = [
                await state.manager.get_budget_status(b.id)
                for b in state.manager.get_all_budgets()
            ]
            summary = await state.storage.get_summary(
                datetime(1970, 1, 1),
                datetime.now(timezone.utc).replace(tzinfo=None)
            )

            if not math.isfinite(summary.total_cost) or any(
                not math.isfinite(status.percentage_used) for status in statuses
            ):
                raise ValueError("Budget calculation exceeds the supported numeric range")

            return json.dumps(
                {
                    "record": record.model_dump(),
                    "duplicate": duplicate,
                    "total_cost": summary.total_cost,
                    "total_requests": summary.total_requests,
                    "budget_configured": bool(statuses),
                    "allowed": not any(status.is_exceeded for status in statuses),
                    "budgets": [status.model_dump() for status in statuses],
                },
                indent=2,
                default=str,
                allow_nan=False,
            )

        except (ValueError, OverflowError):
            if not duplicate:
                state.storage.records.pop(record.id, None)
            raise


@mcp.tool()
async def list_supported_models(provider: str | None = None) -> str:
    """List all supported models and providers for cost tracking.

    Args:
        provider: Optional provider filter (e.g. "openai", "anthropic").
                  If omitted, lists all providers and their models.

    Returns JSON with supported providers and models.
    """
    if provider:
        models = [pricing.model for pricing in get_provider_models(provider)]
        return json.dumps({"provider": provider, "models": models}, indent=2)

    providers = get_supported_providers()
    result = {"providers": list(providers)}
    return json.dumps(result, indent=2)


# ---------------------------------------------------------------------------
# Tools — Utility
# ---------------------------------------------------------------------------


@mcp.tool()
async def redact_pii(text: str) -> str:
    """Redact all detected PII from text and return the cleaned version.

    Replaces PII with tokens like [REDACTED_EMAIL], [REDACTED_SSN], etc.
    Use this to sanitize text before sending it to an AI model or storing it.

    Returns the redacted text string (not JSON).
    """
    guardrail = _get_pii_guardrail()
    result = await guardrail.evaluate(text)

    if result.passed and not result.metadata.get("detections"):
        return text

    return result.metadata.get("redacted_text", text)


@mcp.tool()
async def redact_secrets(text: str) -> str:
    """Redact all detected secrets from text and return the cleaned version.

    Replaces secrets with tokens like [REDACTED_OPENAI_KEY], [REDACTED_AWS_ACCESS_KEY], etc.
    Use this to sanitize text before sending it to an AI model or storing it.

    Returns the redacted text string (not JSON).
    """
    guardrail = _get_secret_guardrail()
    result = await guardrail.evaluate(text)
    metadata = result.metadata if hasattr(result, "metadata") else {}
    return metadata.get("redacted_text", text) if metadata.get("redacted_text") else text


@mcp.tool()
async def security_preflight(
    text: str,
    model: str = "gpt-4",
    input_tokens: int = 0,
    output_tokens: int = 0,
    provider: str = "openai",
) -> str:
    """Combined security + cost check before making an AI API call.

    Runs all guardrails AND estimates cost in a single call. This is the
    recommended pre-flight check for any AI operation.

    Args:
        text: The prompt or message to check
        model: Model to estimate cost for
        input_tokens: Estimated input tokens (0 to skip cost estimate)
        output_tokens: Estimated output tokens (0 to skip cost estimate)
        provider: AI provider name

    Returns JSON with: guardrail_result, cost_estimate, recommendation.
    """
    engine = _get_engine()
    guardrail_result = await engine.execute(text)

    cost_estimate = None
    if input_tokens > 0 or output_tokens > 0:
        tracker = _get_cost_tracker()
        tokens = TokenUsage(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            total_tokens=input_tokens + output_tokens,
        )
        est = tracker.estimate_cost(model=model, estimated_tokens=tokens, provider=provider)
        cost_estimate = est.model_dump()

    # Build recommendation
    if not guardrail_result.passed:
        recommendation = "BLOCK — guardrail violation detected"
    elif guardrail_result.max_risk_score > 50:
        recommendation = "REVIEW — elevated risk score, consider manual review"
    else:
        recommendation = "ALLOW — all checks passed"

    output: dict[str, Any] = {
        "recommendation": recommendation,
        "guardrails": guardrail_result.model_dump(),
    }
    if cost_estimate:
        output["cost_estimate"] = cost_estimate

    return json.dumps(output, indent=2, default=str)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


@mcp.tool()
async def policy_status() -> str:
    """Report which rule types this server enforces, and whether its policy loaded.

    Answerable without evaluating anything, so a client can discover the limits of
    the governance on offer before it depends on them — rather than on the first
    request that mattered.

    `enforced_rule_types` is the whole claim. A rule type listed `unspecified` is
    not evaluated here and not evaluated by the SDK; a policy configuring one is
    refused rather than partly honoured.
    """

    state = _get_policy_state()

    return json.dumps(
        {
            "policy_configured": state.path is not None,
            "policy_file": state.path,
            "policy_loaded": state.engine is not None,
            "error": state.error,
            "rule_type_support": TealEngine.rule_type_support(),
            "enforced_rule_types": [
                name
                for name, support in TealEngine.rule_type_support().items()
                if support == "enforced"
            ],
            "enforcement_is_advisory": True,
            "note": (
                "This server returns decisions; it cannot intercept the client's "
                "actions. A caller that ignores a DENY is not prevented from "
                "proceeding. Treat these decisions as a governance oracle plus an "
                "audit trail, not as a control point."
            ),
        },
        indent=2,
        default=str,
    )


@mcp.tool()
async def evaluate_action(
    action: str,
    tool: str | None = None,
    agent_id: str = "mcp-client",
) -> str:
    """Evaluate an action against the server's configured tool-allowlist policy.

    Returns the decision, the standardized reason codes, and `triggering_clause` —
    the policy clause that produced it. The clause is the field worth reading: it
    distinguishes a decision that was reasoned from one that merely coincided. A
    tool absent from the policy denies as `tools.<name>.absent`, while a tool
    configured `allowed: false` denies as `tools.<name>.allowed`. Same verdict,
    different policy facts.

    **Tool allowlist only.** Call `policy_status` for the full support claim. The
    policy comes from the server's configuration and cannot be supplied here, so
    the agent being governed cannot choose the rules it is judged by.

    **The decision is advisory.** This server cannot intercept your actions. A
    caller that ignores a DENY proceeds anyway; what it cannot do is claim it was
    not told.

    Args:
        action: The operation requested, e.g. `tool.execute`.
        tool: The tool name. Required when action is `tool.execute`.
        agent_id: Identity of the calling agent, recorded on the decision.
    """

    if not action.strip():
        raise ValueError("Action must not be empty")
    if not agent_id.strip():
        raise ValueError("Agent ID must not be empty")

    state = _get_policy_state()
    if state.engine is None:
        # Never an ALLOW. A missing or unusable policy means this server has
        # nothing to judge the request against, and saying so is the only honest
        # answer available.
        raise ValueError(f"Cannot evaluate: {state.error}")

    context: dict[str, Any] = {"agentId": agent_id, "action": action}
    if tool is not None:
        if not tool.strip():
            raise ValueError("Tool must not be empty when supplied")
        context["tool"] = tool

    decision = state.engine.evaluate_with_mode(context)

    return json.dumps(
        {
            "action": decision.action.value,
            "reason_codes": [code.value for code in decision.reason_codes],
            "triggering_clause": decision.triggering_clause,
            "reason": decision.reason,
            "mode": decision.mode.value,
            "policy_id": decision.policy_id,
            "correlation_id": decision.correlation_id,
            # Which policy produced this, stated on the decision itself.
            #
            # Two reasons. For audit, a decision that does not say what judged it
            # is hard to reconstruct later. And because the MCP layer silently
            # drops arguments a tool does not declare: a caller that passes
            # `policy=...` gets no error, and the server's policy governs anyway.
            # Safe, but silent — so the decision says whose policy it used rather
            # than leaving the caller to assume it was theirs.
            "policy_source": "server",
            "policy_file": state.path,
            # The exact context evaluated, so a caller can see that nothing it
            # sent beyond these fields had any effect.
            "request": context,
            "enforced_rule_types": [
                name
                for name, support in TealEngine.rule_type_support().items()
                if support == "enforced"
            ],
            "enforcement_is_advisory": True,
        },
        indent=2,
        default=str,
    )


def main():
    """Run the TealTiger MCP server.

    Refuses to start when a policy is configured but unusable. A governance server
    that comes up healthy while unable to read its own policy is the failure mode
    worth preventing: every other tool would keep working, `evaluate_action` would
    error on each call, and nobody would notice until something was supposed to be
    denied.

    A server with no policy configured starts normally. The other 12 tools do not
    need one, and `evaluate_action` says plainly that it has nothing to evaluate
    against.
    """

    state = _get_policy_state()
    if state.path is not None and state.engine is None:
        print(f"tealtiger-mcp: {state.error}", file=sys.stderr)
        raise SystemExit(2)

    mcp.run()


if __name__ == "__main__":
    main()
