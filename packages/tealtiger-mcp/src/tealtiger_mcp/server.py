"""
TealTiger MCP Server

Exposes TealTiger guardrails, cost tracking, and budget enforcement
as MCP tools for Claude Desktop, Cursor, Kiro, and any MCP client.

Usage:
    tealtiger-mcp                                  # stdio transport (default)
    tealtiger-mcp --transport sse                 # SSE transport for remote access
    tealtiger-mcp --transport streamable-http     # Streamable HTTP transport
"""

import argparse
import json
from typing import Any

from mcp.server.fastmcp import FastMCP

from tealtiger import (
    PIIDetectionGuardrail,
    PromptInjectionGuardrail,
    ContentModerationGuardrail,
    GuardrailEngine,
    CostTracker,
    CostTrackerConfig,
    TokenUsage,
    get_supported_models,
    get_supported_providers,
    is_model_supported,
)

# ---------------------------------------------------------------------------
# Server instance
# ---------------------------------------------------------------------------

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000
_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}

mcp = FastMCP(
    "TealTiger",
    instructions=(
        "Deterministic AI governance: PII detection, prompt injection blocking, "
        "content moderation, cost estimation, and budget checks. "
        "All enforcement runs locally — no data leaves your process."
    ),
    # FastMCP 1.8 defaulted to 0.0.0.0 while newer 1.x releases default to
    # loopback. Set this explicitly so TealTiger stays local by default across
    # the full supported mcp 1.x range.
    host=DEFAULT_HOST,
    port=DEFAULT_PORT,
)

# Newer mcp 1.x releases auto-enable DNS-rebinding protection for localhost.
# Keep the generated setting so repeated main() calls in tests can restore it.
_DEFAULT_TRANSPORT_SECURITY = getattr(mcp.settings, "transport_security", None)

# ---------------------------------------------------------------------------
# Shared instances (lazy-initialized, reused across calls)
# ---------------------------------------------------------------------------

_pii_guardrail: PIIDetectionGuardrail | None = None
_injection_guardrail: PromptInjectionGuardrail | None = None
_moderation_guardrail: ContentModerationGuardrail | None = None
_engine: GuardrailEngine | None = None
_cost_tracker: CostTracker | None = None


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


def _get_engine() -> GuardrailEngine:
    global _engine
    if _engine is None:
        _engine = GuardrailEngine()
        _engine.register_guardrail(_get_pii_guardrail())
        _engine.register_guardrail(_get_injection_guardrail())
        _engine.register_guardrail(_get_moderation_guardrail())
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
async def evaluate_guardrails(text: str) -> str:
    """Run all guardrails (PII, injection, content moderation) on the input text.

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
async def list_supported_models(provider: str | None = None) -> str:
    """List all supported models and providers for cost tracking.

    Args:
        provider: Optional provider filter (e.g. "openai", "anthropic").
                  If omitted, lists all providers and their models.

    Returns JSON with supported providers and models.
    """
    if provider:
        models = get_supported_models()
        filtered = [m for m in models if is_model_supported(m)]
        return json.dumps({"provider": provider, "models": filtered}, indent=2)

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


def _build_parser() -> argparse.ArgumentParser:
    """Build the command-line parser for transport selection."""
    parser = argparse.ArgumentParser(description="Run the TealTiger MCP server.")
    parser.add_argument(
        "--transport",
        choices=("stdio", "sse", "streamable-http"),
        default="stdio",
        help="MCP transport to use (default: stdio).",
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Bind host for SSE or Streamable HTTP (default: {DEFAULT_HOST}).",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=DEFAULT_PORT,
        help=f"Bind port for SSE or Streamable HTTP (default: {DEFAULT_PORT}).",
    )
    return parser


def _configure_network_transport(host: str, port: int) -> None:
    """Apply network settings while keeping FastMCP v1 security coherent."""
    mcp.settings.host = host
    mcp.settings.port = port

    # mcp >= 1.23 auto-enables localhost DNS-rebinding protection at
    # construction time. If the caller deliberately binds beyond loopback,
    # keeping that localhost-only policy would make the listener reject
    # legitimate Host headers. Match FastMCP's own non-loopback construction
    # behaviour by disabling the auto-generated localhost policy in that case.
    # Older mcp 1.x releases do not expose this setting, hence the feature check.
    if hasattr(mcp.settings, "transport_security"):
        mcp.settings.transport_security = (
            _DEFAULT_TRANSPORT_SECURITY if host in _LOOPBACK_HOSTS else None
        )


def main(argv: list[str] | None = None) -> None:
    """Run the TealTiger MCP server using the selected transport."""
    args = _build_parser().parse_args(argv)

    # stdio does not use host/port; network transports do.
    if args.transport != "stdio":
        _configure_network_transport(args.host, args.port)

    mcp.run(transport=args.transport)


if __name__ == "__main__":
    main()
