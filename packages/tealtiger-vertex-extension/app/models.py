"""Request and response models for the TealTiger Governance API."""

from typing import Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

class TextInput(BaseModel):
    text: str = Field(..., description="Text to scan")
    action: str = Field("block", description="Action on detection: block, redact, mask, report, allow")


class RedactRequest(BaseModel):
    text: str = Field(..., description="Text to redact")


class CostEstimateRequest(BaseModel):
    model: str = Field(..., description="Model identifier (e.g. gemini-1.5-pro)")
    provider: str = Field("openai", description="Provider name")
    input_tokens: int = Field(..., ge=0)
    output_tokens: int = Field(..., ge=0)


class ModelEntry(BaseModel):
    provider: str
    model: str


class CostCompareRequest(BaseModel):
    models: list[ModelEntry]
    input_tokens: int = Field(..., ge=0)
    output_tokens: int = Field(..., ge=0)


class BudgetCheckRequest(BaseModel):
    agent_id: str = Field(..., description="Agent or project identifier")
    estimated_cost: float = Field(..., description="Estimated cost of pending request")
    budget_limit: float = Field(..., description="Budget limit in USD")
    current_spending: float = Field(..., description="Current spending in budget period")
    period: str = Field("daily", description="Budget period: hourly, daily, weekly, monthly, total")


class PreflightRequest(BaseModel):
    text: str = Field(..., description="Prompt or message to check")
    model: str = Field("gpt-4")
    provider: str = Field("openai")
    input_tokens: int = Field(0, ge=0)
    output_tokens: int = Field(0, ge=0)


# ---------------------------------------------------------------------------
# Responses
# ---------------------------------------------------------------------------

class DetectionItem(BaseModel):
    type: str
    value: Optional[str] = None
    confidence: Optional[float] = None


class GuardrailResponse(BaseModel):
    passed: bool
    action: str
    reason: str
    risk_score: int = Field(ge=0, le=100)
    detections: list[DetectionItem] = []
    redacted_text: Optional[str] = None
    timestamp: str


class GuardrailEngineResponse(BaseModel):
    passed: bool
    max_risk_score: int = Field(ge=0, le=100)
    failed_guardrails: list[str] = []
    guardrails_executed: int
    execution_time_ms: float
    results: list[dict] = []
    timestamp: str


class RedactResponse(BaseModel):
    redacted_text: str
    detections_count: int


class CostBreakdownResponse(BaseModel):
    input_cost: float
    output_cost: float
    image_cost: Optional[float] = None
    audio_cost: Optional[float] = None


class CostEstimateResponse(BaseModel):
    estimated_cost: float
    model: str
    provider: str
    breakdown: CostBreakdownResponse
    timestamp: str


class CostCompareItem(BaseModel):
    model: str
    provider: str
    estimated_cost: float
    breakdown: CostBreakdownResponse


class BudgetCheckResponse(BaseModel):
    allowed: bool
    remaining: float
    percentage_used: float
    recommendation: str
    reason: str


class PreflightResponse(BaseModel):
    recommendation: str
    guardrails: GuardrailEngineResponse
    cost_estimate: Optional[CostEstimateResponse] = None
