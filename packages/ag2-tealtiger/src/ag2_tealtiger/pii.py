"""Lightweight PII detection for ag2-tealtiger observe mode.

Scans string values in dicts, lists, and plain strings using regex-based
pattern matching to detect personally identifiable information. Used in
observe mode to detect PII in tool call arguments and results without
blocking execution.

PII types detected:
- email: Email addresses
- phone_number: US phone numbers (various formats)
- ssn: Social Security Numbers (XXX-XX-XXXX)
- credit_card: Credit card numbers (16 digits, various separators)
- ip_address: IPv4 addresses

Returns structured detection results with type, location, and confidence.
"""

from __future__ import annotations

import re
from typing import Any


# ── PII Regex Patterns ─────────────────────────────────────────────────────────

_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(
        r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"
    ),
    "phone_number": re.compile(
        r"(\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b"
    ),
    "ssn": re.compile(
        r"\b\d{3}-\d{2}-\d{4}\b"
    ),
    "credit_card": re.compile(
        r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
    ),
    "ip_address": re.compile(
        r"\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b"
    ),
}

# Confidence scores per PII type (higher = more certain the match is real PII)
_CONFIDENCE_SCORES: dict[str, float] = {
    "email": 0.95,
    "phone_number": 0.80,
    "ssn": 0.99,
    "credit_card": 0.90,
    "ip_address": 0.70,
}


# ── Public API ─────────────────────────────────────────────────────────────────


def detect_pii(data: Any) -> list[dict[str, Any]]:
    """Scan data for PII patterns and return detection results.

    Recursively traverses dicts, lists, and plain strings to find
    PII matches using regex patterns.

    Args:
        data: The data to scan. Can be a string, dict, list, or nested
              combination thereof. Non-string leaf values are skipped.

    Returns:
        A list of detection dicts, each containing:
            - type: PII type identifier (e.g., "email", "ssn")
            - value: The matched text
            - location: Dot-notation path to the value (e.g., "args.user.email")
            - confidence: Float 0.0-1.0 indicating detection confidence
            - start: Start index of match within the scanned string
            - end: End index of match within the scanned string
    """
    results: list[dict[str, Any]] = []
    _scan_recursive(data, "", results)
    return results


def detect_pii_in_text(text: str, location: str = "") -> list[dict[str, Any]]:
    """Scan a single string for PII patterns.

    Args:
        text: The string to scan.
        location: Optional path label for the location field in results.

    Returns:
        A list of detection dicts (same format as detect_pii).
    """
    results: list[dict[str, Any]] = []
    _scan_string(text, location, results)
    return results


# ── Internal Helpers ───────────────────────────────────────────────────────────


def _scan_recursive(
    data: Any, path: str, results: list[dict[str, Any]]
) -> None:
    """Recursively scan data structures for PII in string values."""
    if isinstance(data, str):
        _scan_string(data, path, results)
    elif isinstance(data, dict):
        for key, value in data.items():
            child_path = f"{path}.{key}" if path else str(key)
            _scan_recursive(value, child_path, results)
    elif isinstance(data, (list, tuple)):
        for idx, item in enumerate(data):
            child_path = f"{path}[{idx}]" if path else f"[{idx}]"
            _scan_recursive(item, child_path, results)
    # Non-string, non-container types are skipped (int, float, bool, None, etc.)


def _scan_string(
    text: str, location: str, results: list[dict[str, Any]]
) -> None:
    """Scan a single string against all PII patterns."""
    for pii_type, pattern in _PII_PATTERNS.items():
        for match in pattern.finditer(text):
            results.append({
                "type": pii_type,
                "value": match.group(0),
                "location": location,
                "confidence": _CONFIDENCE_SCORES[pii_type],
                "start": match.start(),
                "end": match.end(),
            })
