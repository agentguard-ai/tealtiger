"""
TealTiger Governance API

FastAPI server implementing the TealTiger OpenAPI spec for Vertex AI
Extensions, Google Cloud Marketplace, and standalone deployment.

Run locally:
    uvicorn app.main:app --reload --port 8080

Deploy to Cloud Run:
    gcloud run deploy tealtiger-api --source . --region us-central1
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

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
)

from .models import (
    TextInput,
    RedactRequest,
    CostEstimateRequest,
    CostCompareRequest,
    BudgetCheckRequest,
    PreflightRequest,
    GuardrailResponse,
    GuardrailEngineResponse,
    RedactResponse,
    CostEstimateResponse,
    CostBreakdownResponse,
    CostCompareItem,
    BudgetCheckResponse,
    PreflightResponse,
)

# ---------------------------------------------------------------------------
# Shared state
# ---------------------------------------------------------------------------

pii_guardrail: PIIDetectionGuardrail | None = None
injection_guardrail: PromptInjectionGuardrail | None = None
moderation_guardrail: ContentModerationGuardrail | None = None
engine: GuardrailEngine | None = None
cost_tracker: CostTracker | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize shared instances on startup."""
    global pii_guardrail, injection_guardrail, moderation_guardrail, engine, cost_tracker

    pii_guardrail = PIIDetectionGuardrail({"action": "redact", "enabled": True})
    injection_guardrail = PromptInjectionGuardrail({"action": "block", "enabled": True})
    moderation_guardrail = ContentModerationGuardrail({"action": "block", "enabled": True})

    engine = GuardrailEngine()
    engine.register_guardrail(pii_guardrail)
    engine.register_guardrail(injection_guardrail)
    engine.register_guardrail(moderation_guardrail)

    cost_tracker = CostTracker(CostTrackerConfig(enabled=True))

    yield


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="TealTiger Governance API",
    description=(
        "Deterministic AI governance: PII detection, prompt injection blocking, "
        "content moderation, cost estimation, and budget checks. "
        "All enforcement runs locally — no data leaves your process."
    ),
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Guardrail endpoints
# ---------------------------------------------------------------------------


def _to_guardrail_response(result) -> GuardrailResponse:
    """Convert SDK GuardrailResult to API response."""
    detections = result.metadata.get("detections", [])
    return GuardrailResponse(
        passed=result.passed,
        action=result.action,
        reason=result.reason,
        risk_score=result.risk_score,
        detections=[
            {"type": d.get("type", ""), "value": d.get("value"), "confidence": d.get("confidence")}
            for d in detections
        ],
        redacted_text=result.metadata.get("redacted_text"),
        timestamp=result.timestamp,
    )


@app.post("/v1/guardrails/pii", response_model=GuardrailResponse, tags=["Guardrails"])
async def check_pii(body: TextInput):
    """Scan text for PII. Pure regex, sub-millisecond, fully local."""
    result = await pii_guardrail.evaluate(body.text)
    return _to_guardrail_response(result)


@app.post("/v1/guardrails/injection", response_model=GuardrailResponse, tags=["Guardrails"])
async def check_injection(body: TextInput):
    """Detect prompt injection and jailbreak attempts. Local pattern matching."""
    result = await injection_guardrail.evaluate(body.text)
    return _to_guardrail_response(result)


@app.post("/v1/guardrails/content", response_model=GuardrailResponse, tags=["Guardrails"])
async def check_content(body: TextInput):
    """Scan for content policy violations."""
    result = await moderation_guardrail.evaluate(body.text)
    return _to_guardrail_response(result)


def _to_engine_response(result) -> GuardrailEngineResponse:
    """Convert SDK GuardrailEngineResult to API response."""
    return GuardrailEngineResponse(
        passed=result.passed,
        max_risk_score=result.max_risk_score,
        failed_guardrails=result.failed_guardrails,
        guardrails_executed=result.guardrails_executed,
        execution_time_ms=result.execution_time,
        results=result.results,
        timestamp=result.timestamp,
    )


@app.post("/v1/guardrails/evaluate", response_model=GuardrailEngineResponse, tags=["Guardrails"])
async def evaluate_guardrails(body: TextInput):
    """Run all guardrails (PII, injection, content moderation) on input text."""
    result = await engine.execute(body.text)
    return _to_engine_response(result)


@app.post("/v1/guardrails/redact", response_model=RedactResponse, tags=["Guardrails"])
async def redact_pii(body: RedactRequest):
    """Redact PII and return cleaned text."""
    result = await pii_guardrail.evaluate(body.text)
    detections = result.metadata.get("detections", [])
    redacted = result.metadata.get("redacted_text", body.text)
    return RedactResponse(redacted_text=redacted, detections_count=len(detections))


# ---------------------------------------------------------------------------
# Cost endpoints
# ---------------------------------------------------------------------------


def _make_tokens(input_tokens: int, output_tokens: int) -> TokenUsage:
    return TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=input_tokens + output_tokens,
    )


def _to_cost_response(estimate) -> CostEstimateResponse:
    return CostEstimateResponse(
        estimated_cost=estimate.estimated_cost,
        model=estimate.model,
        provider=estimate.provider,
        breakdown=CostBreakdownResponse(
            input_cost=estimate.breakdown.input_cost,
            output_cost=estimate.breakdown.output_cost,
            image_cost=estimate.breakdown.image_cost,
            audio_cost=estimate.breakdown.audio_cost,
        ),
        timestamp=estimate.timestamp,
    )


@app.post("/v1/cost/estimate", response_model=CostEstimateResponse, tags=["Cost"])
async def estimate_cost(body: CostEstimateRequest):
    """Estimate cost of an AI API call. 7 providers, 95%+ market coverage."""
    tokens = _make_tokens(body.input_tokens, body.output_tokens)
    estimate = cost_tracker.estimate_cost(
        model=body.model, estimated_tokens=tokens, provider=body.provider
    )
    return _to_cost_response(estimate)


@app.post("/v1/cost/compare", tags=["Cost"])
async def compare_costs(body: CostCompareRequest) -> list[CostCompareItem]:
    """Compare costs across models. Returns results sorted cheapest first."""
    tokens = _make_tokens(body.input_tokens, body.output_tokens)
    results = []
    for entry in body.models:
        estimate = cost_tracker.estimate_cost(
            model=entry.model, estimated_tokens=tokens, provider=entry.provider
        )
        results.append(CostCompareItem(
            model=entry.model,
            provider=entry.provider,
            estimated_cost=estimate.estimated_cost,
            breakdown=CostBreakdownResponse(
                input_cost=estimate.breakdown.input_cost,
                output_cost=estimate.breakdown.output_cost,
                image_cost=estimate.breakdown.image_cost,
                audio_cost=estimate.breakdown.audio_cost,
            ),
        ))
    results.sort(key=lambda r: r.estimated_cost)
    return results


@app.post("/v1/cost/check-budget", response_model=BudgetCheckResponse, tags=["Cost"])
async def check_budget(body: BudgetCheckRequest):
    """Deterministic budget enforcement. Same state + same policy = same decision."""
    remaining = body.budget_limit - body.current_spending
    after_request = body.current_spending + body.estimated_cost
    percentage_used = (after_request / body.budget_limit * 100) if body.budget_limit > 0 else 100.0
    allowed = after_request <= body.budget_limit

    if not allowed:
        recommendation = "BLOCK"
        reason = f"Request would exceed budget: ${after_request:.4f} > ${body.budget_limit:.2f}"
    elif percentage_used > 90:
        recommendation = "WARN"
        reason = f"Budget {percentage_used:.1f}% consumed after this request"
    else:
        recommendation = "ALLOW"
        reason = f"Within budget: ${remaining:.4f} remaining"

    return BudgetCheckResponse(
        allowed=allowed,
        remaining=max(0, remaining - body.estimated_cost),
        percentage_used=min(percentage_used, 100.0),
        recommendation=recommendation,
        reason=reason,
    )


@app.get("/v1/models", tags=["Cost"])
async def list_models(provider: str | None = Query(None)):
    """List supported providers and models for cost tracking."""
    providers = list(get_supported_providers())
    if provider:
        return {"provider": provider, "models": get_supported_models()}
    return {"providers": providers}


# ---------------------------------------------------------------------------
# Preflight endpoint
# ---------------------------------------------------------------------------


@app.post("/v1/preflight", response_model=PreflightResponse, tags=["Preflight"])
async def security_preflight(body: PreflightRequest):
    """Combined security + cost pre-flight check. Returns ALLOW/BLOCK/REVIEW."""
    guardrail_result = await engine.execute(body.text)

    cost_estimate = None
    if body.input_tokens > 0 or body.output_tokens > 0:
        tokens = _make_tokens(body.input_tokens, body.output_tokens)
        est = cost_tracker.estimate_cost(
            model=body.model, estimated_tokens=tokens, provider=body.provider
        )
        cost_estimate = _to_cost_response(est)

    if not guardrail_result.passed:
        recommendation = "BLOCK"
    elif guardrail_result.max_risk_score > 50:
        recommendation = "REVIEW"
    else:
        recommendation = "ALLOW"

    return PreflightResponse(
        recommendation=recommendation,
        guardrails=_to_engine_response(guardrail_result),
        cost_estimate=cost_estimate,
    )


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------


@app.get("/health")
async def health():
    """Health check for Cloud Run / load balancers."""
    return {"status": "ok", "version": "1.1.0"}
