"""Pre-built policy templates for TealTiger Haystack governance."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class PolicyTemplate:
    """Configuration and deterministic rules for one pre-built template."""

    slug: str
    name: str
    description: str
    mode: str
    pii_action: str = "observe"
    block_prompt_injection: bool = False
    enforce_data_boundary: bool = False
    max_cost_per_session: float | None = None
    max_evaluations: int | None = None
    require_human_escalation: bool = False
    data_classification: str = "internal"


_TEMPLATES: dict[str, PolicyTemplate] = {
    "healthcare-guard": PolicyTemplate(
        slug="healthcare-guard",
        name="Healthcare Guard",
        description="PHI/HIPAA-oriented PII redaction and restricted data classification.",
        mode="OBSERVE",
        pii_action="redact",
        data_classification="restricted",
    ),
    "financial-rag": PolicyTemplate(
        slug="financial-rag",
        name="Financial RAG",
        description="Prompt-injection blocking and data-boundary enforcement for financial RAG.",
        mode="ENFORCE",
        block_prompt_injection=True,
        enforce_data_boundary=True,
        data_classification="confidential",
    ),
    "agent-loop-safe": PolicyTemplate(
        slug="agent-loop-safe",
        name="Agent Loop Safe",
        description="Budget, failure, and iteration guardrails for agent loops.",
        mode="ENFORCE",
        max_cost_per_session=0.50,
        max_evaluations=10,
    ),
    "eu-ai-act": PolicyTemplate(
        slug="eu-ai-act",
        name="EU AI Act",
        description="Audit-first decisions with human escalation for high-risk automation.",
        mode="ENFORCE",
        require_human_escalation=True,
        data_classification="regulated",
    ),
    "zero-config": PolicyTemplate(
        slug="zero-config",
        name="Zero Config",
        description="Observe-only telemetry with PII detection, cost tracking, and no blocking.",
        mode="OBSERVE",
    ),
}

_PROMPT_INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:ignore|disregard|forget)\s+(?:all\s+)?"
        r"(?:previous|prior|above|earlier)\s+"
        r"(?:instructions|messages|rules)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:reveal|print|show|disclose|dump)\s+(?:the\s+)?"
        r"(?:system|developer)\s+(?:prompt|message|instructions?)\b",
        re.IGNORECASE,
    ),
)

_DATA_BOUNDARY_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\b(?:account|customer|portfolio|transaction)\s+\d+\b", re.IGNORECASE),
    re.compile(r"\b(?:export|exfiltrate|leak|dump)\s+(?:customer|account|portfolio)\b", re.IGNORECASE),
)

_HIGH_RISK_AI_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(
        r"\b(?:hire|hiring|candidate|employment|credit|loan|benefits?|"
        r"medical|diagnosis|biometric|law enforcement)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(?:automatically|without human review|reject|deny|approve)\b",
        re.IGNORECASE,
    ),
)


def list_policy_templates() -> list[str]:
    """Return all built-in policy template slugs in stable order."""
    return sorted(_TEMPLATES)


def get_policy_template(slug: str) -> PolicyTemplate:
    """Return a built-in policy template by slug."""
    try:
        return _TEMPLATES[slug]
    except KeyError as exc:
        valid = ", ".join(list_policy_templates())
        raise ValueError(f"unknown policy template '{slug}'. Valid templates: {valid}") from exc


def evaluate_template_policy(
    template: PolicyTemplate,
    *,
    text: str,
    pii_findings: list[Any],
    cumulative_cost: float,
    evaluation_count: int,
) -> dict[str, Any]:
    """Evaluate deterministic policy rules for a template."""
    action = "ALLOW"
    output_text = text
    reason = f"Allowed by {template.name} template"
    reason_codes = [f"PRESET_{template.slug.upper().replace('-', '_')}"]
    risk_score = 0
    metadata: dict[str, Any] = {
        "preset": template.slug,
        "template_name": template.name,
        "data_classification": template.data_classification,
        "human_escalation": False,
    }

    if template.pii_action == "redact" and pii_findings:
        action = "MODIFY"
        output_text = _redact_pii(text, pii_findings)
        reason = "PII/PHI detected and redacted by healthcare guard template"
        reason_codes.append("PII_REDACTED")
        risk_score = min(len(pii_findings) * 25, 90)

    if template.block_prompt_injection and _matches_any(text, _PROMPT_INJECTION_PATTERNS):
        action = "DENY"
        output_text = ""
        reason = "Blocked prompt-injection attempt by financial RAG template"
        reason_codes.extend(["PROMPT_INJECTION", "DATA_BOUNDARY_ENFORCEMENT"])
        risk_score = max(risk_score, 90)

    if template.enforce_data_boundary and _matches_any(text, _DATA_BOUNDARY_PATTERNS):
        reason_codes.append("DATA_BOUNDARY_MATCH")
        risk_score = max(risk_score, 70)

    if template.max_cost_per_session is not None and cumulative_cost > template.max_cost_per_session:
        action = "DENY"
        output_text = ""
        reason = "Blocked runaway agent cost by agent-loop-safe template"
        reason_codes.append("BUDGET_LIMIT")
        risk_score = max(risk_score, 95)

    if template.max_evaluations is not None and evaluation_count > template.max_evaluations:
        action = "DENY"
        output_text = ""
        reason = "Blocked runaway agent iteration count by agent-loop-safe template"
        reason_codes.append("ITERATION_LIMIT")
        risk_score = max(risk_score, 90)

    if template.require_human_escalation and _matches_any(text, _HIGH_RISK_AI_PATTERNS):
        action = "DENY"
        output_text = ""
        reason = "Human escalation required for high-risk AI decision"
        reason_codes.extend(["HIGH_RISK_AI", "HUMAN_ESCALATION_REQUIRED"])
        metadata["human_escalation"] = True
        risk_score = max(risk_score, 85)

    return {
        "action": action,
        "text": output_text,
        "reason": reason,
        "reason_codes": _dedupe(reason_codes),
        "risk_score": risk_score,
        "metadata": metadata,
    }


def _matches_any(text: str, patterns: tuple[re.Pattern[str], ...]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def _redact_pii(text: str, pii_findings: list[Any]) -> str:
    redacted = text
    for finding in sorted(pii_findings, key=lambda item: item.start, reverse=True):
        redacted = redacted[: finding.start] + "[REDACTED]" + redacted[finding.end :]
    return redacted


def _dedupe(items: list[str]) -> list[str]:
    return list(dict.fromkeys(items))
