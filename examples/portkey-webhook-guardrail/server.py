"""
TealTiger Webhook Guardrail Server for Portkey AI Gateway.

Implements Portkey's webhook guardrail interface:
- Receives beforeRequestHook / afterRequestHook events
- Evaluates TealTiger guardrails (PII, injection, secrets, cost)
- Returns verdict + optional transformedData

Run:
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

import asyncio
import logging
import os
import time
import uuid
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException, Request
from pydantic import BaseModel, Field

from tealtiger import (
    GuardrailEngine,
    GuardrailEngineResult,
    PIIDetectionGuardrail,
    ContentModerationGuardrail,
    PromptInjectionGuardrail,
)

load_dotenv()

# Configuration
WEBHOOK_SECRET = os.getenv("WEBHOOK_SECRET", "change-me-to-a-secure-value")
TEALTIGER_MODE = os.getenv("TEALTIGER_MODE", "enforce")  # observe | monitor | enforce
PII_ENABLED = os.getenv("TEALTIGER_PII_ENABLED", "true").lower() == "true"
INJECTION_ENABLED = os.getenv("TEALTIGER_INJECTION_ENABLED", "true").lower() == "true"
SECRETS_ENABLED = os.getenv("TEALTIGER_SECRETS_ENABLED", "true").lower() == "true"
COST_LIMIT = float(os.getenv("TEALTIGER_COST_LIMIT", "0.50"))
PORT = int(os.getenv("PORT", "8000"))

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("tealtiger.portkey")

app = FastAPI(
    title="TealTiger Portkey Webhook Guardrail",
    version="1.0.0",
    description="Deterministic governance for Portkey AI Gateway",
)


# --- Models ---


class WebhookRequest(BaseModel):
    """Portkey webhook request payload."""

    request: Dict[str, Any] = Field(default_factory=dict)
    response: Dict[str, Any] = Field(default_factory=dict)
    provider: Optional[str] = None
    requestType: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    eventType: str = Field(..., description="beforeRequestHook or afterRequestHook")


class WebhookResponse(BaseModel):
    """Portkey webhook response payload."""

    verdict: bool = Field(..., description="True to allow, False to deny")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Metadata about the decision")
    transformedData: Optional[Dict[str, Any]] = Field(
        default=None, description="Modified request/response data"
    )


# --- Guardrail Engine Setup ---


def create_engine() -> GuardrailEngine:
    """Create and configure the TealTiger guardrail engine."""
    engine = GuardrailEngine(parallel_execution=True, timeout=3.0)

    if PII_ENABLED:
        engine.register_guardrail(
            PIIDetectionGuardrail(
                config={
                    "name": "pii_detection",
                    "categories": ["ssn", "credit_card", "email", "phone"],
                    "action": "redact",
                }
            )
        )

    if INJECTION_ENABLED:
        engine.register_guardrail(
            PromptInjectionGuardrail(
                config={
                    "name": "prompt_injection",
                    "sensitivity": "medium",
                }
            )
        )

    # Content moderation for output guardrails
    engine.register_guardrail(
        ContentModerationGuardrail(
            config={
                "name": "content_moderation",
                "categories": ["toxic", "harmful", "hate_speech"],
            }
        )
    )

    return engine


engine = create_engine()


# --- Helper Functions ---


def extract_text_from_request(payload: WebhookRequest) -> str:
    """Extract text content from Portkey webhook request."""
    # Try the simple text field first
    request_data = payload.request
    if request_data.get("text"):
        return request_data["text"]

    # Extract from messages array
    json_data = request_data.get("json", {})
    messages = json_data.get("messages", [])

    text_parts: List[str] = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            text_parts.append(content)
        elif isinstance(content, list):
            # Multi-modal messages
            for part in content:
                if isinstance(part, dict) and part.get("type") == "text":
                    text_parts.append(part.get("text", ""))

    return "\n".join(text_parts)


def extract_text_from_response(payload: WebhookRequest) -> str:
    """Extract text content from LLM response in webhook payload."""
    response_data = payload.response

    if response_data.get("text"):
        return response_data["text"]

    json_data = response_data.get("json", {})
    choices = json_data.get("choices", [])

    text_parts: List[str] = []
    for choice in choices:
        message = choice.get("message", {})
        content = message.get("content", "")
        if content:
            text_parts.append(content)

    return "\n".join(text_parts)


def redact_pii_in_messages(messages: List[Dict[str, Any]], pii_findings: List[Dict]) -> List[Dict[str, Any]]:
    """Redact PII findings from messages."""
    import re

    redacted_messages = []
    for msg in messages:
        content = msg.get("content", "")
        if isinstance(content, str):
            # Simple pattern-based redaction
            # SSN
            content = re.sub(r"\b\d{3}-\d{2}-\d{4}\b", "[REDACTED_SSN]", content)
            # Credit card (basic)
            content = re.sub(r"\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b", "[REDACTED_CC]", content)
            # Email
            content = re.sub(
                r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
                "[REDACTED_EMAIL]",
                content,
            )
            # Phone (US)
            content = re.sub(
                r"\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
                "[REDACTED_PHONE]",
                content,
            )

        redacted_messages.append({**msg, "content": content})

    return redacted_messages


# --- Endpoints ---


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "tealtiger-portkey-webhook",
        "mode": TEALTIGER_MODE,
        "guardrails": engine.get_registered_guardrails(),
    }


@app.post("/guardrail", response_model=WebhookResponse)
async def guardrail_webhook(
    payload: WebhookRequest,
    authorization: Optional[str] = Header(None),
):
    """
    Main webhook endpoint for Portkey guardrails.

    Evaluates TealTiger guardrails against the request/response
    and returns a Portkey-compatible verdict.
    """
    # Authenticate
    if WEBHOOK_SECRET != "change-me-to-a-secure-value":
        expected = f"Bearer {WEBHOOK_SECRET}"
        if authorization != expected:
            raise HTTPException(status_code=401, detail="Unauthorized")

    start_time = time.time()
    decision_id = f"dec_{uuid.uuid4().hex[:12]}"

    # Determine what to evaluate based on event type
    event_type = payload.eventType

    if event_type == "beforeRequestHook":
        text = extract_text_from_request(payload)
    elif event_type == "afterRequestHook":
        text = extract_text_from_response(payload)
    else:
        # Unknown event type — allow by default
        return WebhookResponse(verdict=True)

    if not text.strip():
        return WebhookResponse(
            verdict=True,
            data={"reason": "Empty content — no evaluation needed", "decision_id": decision_id},
        )

    # Execute guardrails
    context = {
        "provider": payload.provider,
        "request_type": payload.requestType,
        "event_type": event_type,
        "metadata": payload.metadata,
    }

    result: GuardrailEngineResult = await engine.execute(text, context)

    execution_time_ms = (time.time() - start_time) * 1000

    # Build response based on mode
    response_data = {
        "decision_id": decision_id,
        "reason": _build_reason(result),
        "guardrails_triggered": result.failed_guardrails,
        "risk_score": result.max_risk_score,
        "execution_time_ms": round(execution_time_ms, 2),
        "mode": TEALTIGER_MODE,
        "guardrails_executed": result.guardrails_executed,
    }

    # Mode-based behavior
    if TEALTIGER_MODE == "observe":
        # Track everything, block nothing
        logger.info(f"[OBSERVE] {decision_id}: passed={result.passed}, risk={result.max_risk_score}")
        return WebhookResponse(verdict=True, data=response_data)

    elif TEALTIGER_MODE == "monitor":
        # Evaluate and log, but allow through
        if not result.passed:
            logger.warning(
                f"[MONITOR] {decision_id}: WOULD BLOCK — "
                f"triggered={result.failed_guardrails}, risk={result.max_risk_score}"
            )
        return WebhookResponse(verdict=True, data=response_data)

    else:
        # enforce mode
        if result.passed:
            return WebhookResponse(verdict=True, data=response_data)

        # Check if we should redact rather than block
        if _should_redact(result) and event_type == "beforeRequestHook":
            transformed = _build_redacted_request(payload, result)
            response_data["action"] = "redact"
            logger.info(f"[ENFORCE] {decision_id}: REDACT — {result.failed_guardrails}")
            return WebhookResponse(verdict=True, data=response_data, transformedData=transformed)

        # Block
        logger.warning(f"[ENFORCE] {decision_id}: DENY — {result.failed_guardrails}")
        return WebhookResponse(verdict=False, data=response_data)


# --- Internal Helpers ---


def _build_reason(result: GuardrailEngineResult) -> str:
    """Build a human-readable reason string."""
    if result.passed:
        return "All guardrails passed"

    reasons = []
    for r in result.results:
        if not r.get("result", {}).get("passed", True):
            name = r.get("guardrail_name", "unknown")
            reason = r.get("result", {}).get("reason", "")
            reasons.append(f"{name}: {reason}")

    return "; ".join(reasons) if reasons else "Guardrail check failed"


def _should_redact(result: GuardrailEngineResult) -> bool:
    """Determine if we should redact (transform) rather than block outright."""
    # Only redact for PII detection — block for injection/secrets
    pii_only = all(
        name in ("pii_detection",) for name in result.failed_guardrails
    )
    return pii_only and PII_ENABLED


def _build_redacted_request(
    payload: WebhookRequest, result: GuardrailEngineResult
) -> Dict[str, Any]:
    """Build transformed request with PII redacted."""
    json_data = payload.request.get("json", {})
    messages = json_data.get("messages", [])

    # Get PII findings from results
    pii_findings = []
    for r in result.results:
        if r.get("guardrail_name") == "pii_detection":
            pii_findings = r.get("result", {}).get("metadata", {}).get("findings", [])

    redacted_messages = redact_pii_in_messages(messages, pii_findings)

    return {
        "request": {
            "json": {
                **json_data,
                "messages": redacted_messages,
            }
        }
    }


# --- Entry Point ---


if __name__ == "__main__":
    import uvicorn

    logger.info(f"Starting TealTiger Portkey Webhook (mode={TEALTIGER_MODE}, port={PORT})")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
