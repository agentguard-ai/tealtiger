"""
Secret detection for the TealTiger MCP server.

Detects leaked credentials (API keys, tokens, private keys) using
deterministic regex patterns — no external services, no data leaves
your process.

Uses the same patterns as the TealTiger SDK integrations
(ag2-tealtiger middleware, anthropic-tealtiger, dify-plugin-tealtiger).
Extends the TealTiger SDK ``Guardrail`` base class so it registers
with the engine and participates in ``evaluate_guardrails``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Optional

from tealtiger.guardrails.base import Guardrail, GuardrailResult

# Secret-detection patterns shared across TealTiger integration packages.
# Same set used by ag2-tealtiger middleware / anthropic-tealtiger client.
_SECRET_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("openai_key", re.compile(r"\b(sk-[a-zA-Z0-9]{20,})\b")),
    ("github_pat", re.compile(r"\b(ghp_[a-zA-Z0-9]{36,})\b")),
    ("aws_access_key", re.compile(r"\b(AKIA[0-9A-Z]{16})\b")),
    ("slack_token", re.compile(r"\b(xox[bpors]-[a-zA-Z0-9-]+)\b")),
    ("private_key", re.compile(
        r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----"
    )),
    ("generic_token", re.compile(
        r"\b(token|secret|password)\s*[:=]\s*['\"]?[a-zA-Z0-9_\-]{16,}['\"]?",
        re.IGNORECASE,
    )),
]


def _redact(matched: str) -> str:
    """Redact a matched secret for safe display (first 4 + last 2 chars)."""
    if len(matched) <= 8:
        return "****"
    return matched[:4] + "*" * (len(matched) - 6) + matched[-2:]


@dataclass
class _Finding:
    """Internal: a matched secret with its original bounds."""

    type: str
    matched: str
    position: int
    length: int


class SecretDetectionGuardrail(Guardrail):
    """Deterministic secret / credential detection.

    Runs fully local — no network calls, no data leaves your process.
    Extends the TealTiger SDK ``Guardrail`` so it composes with the
    shared ``GuardrailEngine`` (``evaluate_guardrails`` runs it
    alongside PII, injection, and content guardrails).
    """

    def __init__(self, config: dict[str, Any] | None = None):
        super().__init__(config)
        self.action = (config or {}).get("action", "block")

    def _scan(self, text: str) -> list[_Finding]:
        """Find all secret matches in ``text``."""
        findings: list[_Finding] = []
        for pattern_name, pattern in _SECRET_PATTERNS:
            for match in pattern.finditer(text):
                findings.append(_Finding(
                    type=pattern_name,
                    matched=match.group(0),
                    position=match.start(),
                    length=len(match.group(0)),
                ))
        return findings

    def _build_redacted(self, text: str, findings: list[_Finding]) -> str:
        """Build a redacted copy of ``text`` by replacing each match."""
        if not findings:
            return text
        # Walk backwards so earlier offsets stay valid after replacement
        sorted_findings = sorted(findings, key=lambda f: f.position, reverse=True)
        for f in sorted_findings:
            text = (
                text[:f.position]
                + "[REDACTED_" + f.type.upper() + "]"
                + text[f.position + f.length:]
            )
        return text

    async def evaluate(
        self,
        input_data: Any,
        context: dict[str, Any] | None = None,
    ) -> GuardrailResult:
        """Scan text for leaked secrets and return a GuardrailResult.

        ``input_data`` may be a string or any value — non-string input
        is coerced to ``str`` (consistent with how the other SDK
        guardrails handle arbitrary input).
        """
        text = str(input_data) if not isinstance(input_data, str) else input_data

        if not self.enabled:
            return GuardrailResult(
                passed=True,
                action="allow",
                reason="Secret detection disabled",
            )

        findings = self._scan(text)
        redacted = self._build_redacted(text, findings)

        passed = len(findings) == 0
        risk_score = min(95, len(findings) * 30)

        return GuardrailResult(
            passed=passed,
            action="allow" if passed else self.action,
            reason=(
                "No secrets detected"
                if passed
                else f"Detected {len(findings)} leaked credential(s)"
            ),
            risk_score=risk_score,
            metadata={
                "findings_count": len(findings),
                "findings": [
                    {
                        "type": f.type,
                        "matched": _redact(f.matched),
                        "position": f.position,
                    }
                    for f in findings
                ],
                "redacted_text": redacted if findings else text,
            },
        )

    # Backward-compat wrapper used by the MCP server's standalone tool
    async def scan(self, text: str) -> GuardrailResult:
        """Scan text for secrets — returns the GuardrailResult directly."""
        return await self.evaluate(text)
