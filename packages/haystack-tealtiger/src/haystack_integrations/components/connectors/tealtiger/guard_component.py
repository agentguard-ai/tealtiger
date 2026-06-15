"""Prompt-injection guard component for Haystack agent handoffs."""

from __future__ import annotations

import json
import re
import time
import uuid
from dataclasses import asdict, dataclass
from typing import Any

from haystack import component


@dataclass(frozen=True)
class GuardFinding:
    """Safe metadata for one prompt-injection detector match."""

    type: str
    start: int
    end: int
    pattern: str


@dataclass(frozen=True)
class GuardReceipt:
    """Structured receipt for one guarded Haystack handoff."""

    correlation_id: str
    timestamp_ms: float
    field_name: str
    mode: str
    action: str
    blocked: bool
    reason: str
    reason_codes: list[str]
    risk_score: int
    findings: list[dict[str, Any]]
    clean_output_length: int
    human_escalation: bool
    metadata: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        """Convert to a JSON-serializable dictionary."""
        return asdict(self)


_DETECTION_PATTERNS: dict[str, list[tuple[str, re.Pattern[str]]]] = {
    "prompt_injection": [
        (
            "ignore_previous_instructions",
            re.compile(
                r"\b(?:ignore|disregard|forget)\s+(?:all\s+)?"
                r"(?:previous|prior|above|earlier)\s+"
                r"(?:instructions|messages|rules)\b",
                re.IGNORECASE,
            ),
        ),
        (
            "prompt_disclosure",
            re.compile(
                r"\b(?:reveal|print|show|disclose|dump)\s+(?:the\s+)?"
                r"(?:system|developer)\s+(?:prompt|message|instructions?)\b",
                re.IGNORECASE,
            ),
        ),
    ],
    "jailbreak": [
        (
            "dan",
            re.compile(r"\bDAN\b|\bdo anything now\b", re.IGNORECASE),
        ),
        (
            "unrestricted_mode",
            re.compile(
                r"\b(?:jailbreak|developer mode|unrestricted agent|no restrictions|"
                r"bypass safety|without ethical limits)\b",
                re.IGNORECASE,
            ),
        ),
    ],
    "instruction_override": [
        (
            "ignore_previous_instructions",
            re.compile(
                r"\b(?:ignore|disregard|forget)\s+(?:all\s+)?"
                r"(?:previous|prior|above|earlier)\s+"
                r"(?:instructions|messages|rules)\b",
                re.IGNORECASE,
            ),
        ),
        (
            "new_role",
            re.compile(
                r"\b(?:from now on|new instructions?|you are now|act as|"
                r"instead you must)\b",
                re.IGNORECASE,
            ),
        ),
        (
            "override_system_or_developer",
            re.compile(
                r"\b(?:ignore|override|replace)\s+(?:the\s+)?"
                r"(?:developer|system)\s+(?:message|prompt|instructions?)\b",
                re.IGNORECASE,
            ),
        ),
    ],
}


@component
class TealTigerGuardComponent:
    """Block or refer prompt-injection attempts between Haystack agents."""

    _VALID_MODES = {"enforce", "refer"}

    def __init__(self, mode: str = "enforce", agent_id: str | None = None) -> None:
        """Initialize the guard component.

        Args:
            mode: ``"enforce"`` blocks detected attacks, ``"refer"`` escalates
                detected attacks for human review.
            agent_id: Optional identifier included in receipts.
        """
        normalized_mode = mode.lower()
        if normalized_mode not in self._VALID_MODES:
            valid = ", ".join(sorted(self._VALID_MODES))
            raise ValueError(f"mode must be one of: {valid}")

        self._mode = normalized_mode
        self._agent_id = agent_id or f"haystack-guard-{uuid.uuid4().hex[:8]}"
        self._audit_trail: list[GuardReceipt] = []

    @component.output_types(
        clean_output=str,
        blocked=bool,
        action=str,
        receipt=dict,
        findings=list,
    )
    def run(
        self,
        text: str,
        field_name: str = "text",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Validate a text field before it reaches a downstream agent."""
        findings = self._detect(text)
        blocked = bool(findings)
        human_escalation = blocked and self._mode == "refer"
        action = self._action_for(blocked=blocked)
        reason_codes = self._reason_codes(findings=findings, human_escalation=human_escalation)
        clean_output = "" if blocked else text

        receipt = GuardReceipt(
            correlation_id=str(uuid.uuid4()),
            timestamp_ms=time.time() * 1000,
            field_name=field_name,
            mode=self._mode,
            action=action,
            blocked=blocked,
            reason=self._reason(blocked=blocked, findings=findings),
            reason_codes=reason_codes,
            risk_score=self._risk_score(findings),
            findings=[asdict(finding) for finding in findings],
            clean_output_length=len(clean_output),
            human_escalation=human_escalation,
            metadata={
                "agent_id": self._agent_id,
                "input_length": len(text),
                **(metadata or {}),
            },
        )
        self._audit_trail.append(receipt)

        receipt_dict = receipt.to_dict()
        return {
            "clean_output": clean_output,
            "blocked": blocked,
            "action": action,
            "receipt": receipt_dict,
            "findings": receipt_dict["findings"],
        }

    def _detect(self, text: str) -> list[GuardFinding]:
        """Return deterministic prompt-injection findings without raw snippets."""
        findings: list[GuardFinding] = []
        for finding_type, named_patterns in _DETECTION_PATTERNS.items():
            for pattern_name, pattern in named_patterns:
                findings.extend(
                    GuardFinding(
                        type=finding_type,
                        start=match.start(),
                        end=match.end(),
                        pattern=pattern_name,
                    )
                    for match in pattern.finditer(text)
                )

        return sorted(findings, key=lambda finding: (finding.start, finding.type))

    def _action_for(self, blocked: bool) -> str:
        """Return the component action for the current mode and detection result."""
        if not blocked:
            return "allow"
        if self._mode == "refer":
            return "refer"
        return "block"

    def _reason_codes(
        self,
        findings: list[GuardFinding],
        human_escalation: bool,
    ) -> list[str]:
        """Build stable machine-readable reason codes."""
        if not findings:
            return ["NO_INJECTION_DETECTED"]

        codes = sorted({finding.type.upper() for finding in findings})
        if human_escalation:
            codes.append("HUMAN_ESCALATION")
        return codes

    def _reason(self, blocked: bool, findings: list[GuardFinding]) -> str:
        """Return a human-readable receipt reason."""
        if not blocked:
            return "Allowed: no prompt injection detected"

        return f"Blocked: {len(findings)} potential prompt-injection finding(s)"

    def _risk_score(self, findings: list[GuardFinding]) -> int:
        """Score risk by detector category coverage."""
        if not findings:
            return 0

        return min(40 * len({finding.type for finding in findings}), 100)

    @property
    def audit_trail(self) -> list[dict[str, Any]]:
        """Return all guard receipts as dictionaries."""
        return [entry.to_dict() for entry in self._audit_trail]

    def export_audit_trail(self, path: str) -> int:
        """Export guard receipts as JSONL and return the number written."""
        with open(path, "w", encoding="utf-8") as f:
            for entry in self._audit_trail:
                f.write(json.dumps(entry.to_dict()) + "\n")

        return len(self._audit_trail)

    def reset(self) -> None:
        """Clear the session audit trail."""
        self._audit_trail = []
