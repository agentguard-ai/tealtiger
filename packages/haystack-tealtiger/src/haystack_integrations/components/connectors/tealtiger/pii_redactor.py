"""PII redaction component for Haystack RAG pipelines."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any

from haystack import component


_PII_PATTERNS: dict[str, re.Pattern[str]] = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "ssn": re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),
    "credit_card": re.compile(r"\b(?:\d{4}[-\s]?){3}\d{4}\b"),
    "phone_number": re.compile(
        r"\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
    ),
    "api_key": re.compile(
        r"\b(?:sk-[A-Za-z0-9][A-Za-z0-9_-]{10,}|"
        r"AKIA[0-9A-Z]{16}|"
        r"(?i:api[_-]?key)\s*[:=]\s*[\"']?[A-Za-z0-9][A-Za-z0-9._-]{7,})"
    ),
}


@dataclass(frozen=True)
class PIIRedactionFinding:
    """Safe metadata describing a PII match without storing the raw value."""

    type: str
    start: int
    end: int
    replacement: str
    document_index: int


@component
class TealTigerPIIRedactor:
    """Redact or flag PII in retrieved Haystack documents before generation."""

    _VALID_ACTIONS = {"redact", "flag"}

    def __init__(
        self,
        action: str = "redact",
        replacement: str = "[REDACTED]",
        pii_types: list[str] | None = None,
    ) -> None:
        """Initialize the redactor.

        Args:
            action: ``"redact"`` replaces PII; ``"flag"`` records findings only.
            replacement: Text used when redacting a finding.
            pii_types: Optional subset of PII types to detect.
        """
        if action not in self._VALID_ACTIONS:
            valid = ", ".join(sorted(self._VALID_ACTIONS))
            raise ValueError(f"action must be one of: {valid}")

        unknown_types = set(pii_types or []) - set(_PII_PATTERNS)
        if unknown_types:
            unknown = ", ".join(sorted(unknown_types))
            raise ValueError(f"unknown pii_types: {unknown}")

        self._action = action
        self._replacement = replacement
        self._patterns = {
            pii_type: pattern
            for pii_type, pattern in _PII_PATTERNS.items()
            if pii_types is None or pii_type in pii_types
        }

    @component.output_types(clean_documents=list, summary=dict)
    def run(self, documents: list[Any]) -> dict[str, Any]:
        """Return documents safe to pass from retriever output to an LLM generator."""
        clean_documents: list[Any] = []
        all_findings: list[PIIRedactionFinding] = []

        for document_index, document in enumerate(documents):
            content = getattr(document, "content", None)
            text = content or ""
            findings = self._detect(text, document_index)
            all_findings.extend(findings)

            clean_content = text
            if self._action == "redact" and findings:
                clean_content = self._redact(text, findings)

            clean_documents.append(
                self._copy_document(
                    document=document,
                    content=clean_content,
                    findings=findings,
                )
            )

        return {
            "clean_documents": clean_documents,
            "summary": {
                "action": self._action,
                "documents_processed": len(documents),
                "findings_total": len(all_findings),
                "findings": [asdict(finding) for finding in all_findings],
            },
        }

    def _detect(self, text: str, document_index: int) -> list[PIIRedactionFinding]:
        """Detect non-overlapping PII matches in text."""
        candidates: list[PIIRedactionFinding] = []
        for pii_type, pattern in self._patterns.items():
            candidates.extend(
                PIIRedactionFinding(
                    type=pii_type,
                    start=match.start(),
                    end=match.end(),
                    replacement=self._replacement,
                    document_index=document_index,
                )
                for match in pattern.finditer(text)
            )

        selected: list[PIIRedactionFinding] = []
        occupied_ranges: list[range] = []
        for finding in sorted(candidates, key=lambda item: (item.start, -(item.end - item.start))):
            finding_range = range(finding.start, finding.end)
            if any(_ranges_overlap(finding_range, occupied) for occupied in occupied_ranges):
                continue
            selected.append(finding)
            occupied_ranges.append(finding_range)

        return selected

    def _redact(self, text: str, findings: list[PIIRedactionFinding]) -> str:
        """Apply replacements from the end of the string to preserve offsets."""
        clean_text = text
        for finding in sorted(findings, key=lambda item: item.start, reverse=True):
            clean_text = (
                clean_text[: finding.start] + self._replacement + clean_text[finding.end :]
            )
        return clean_text

    def _copy_document(
        self,
        document: Any,
        content: str,
        findings: list[PIIRedactionFinding],
    ) -> Any:
        """Copy a Haystack Document-like object with updated content and metadata."""
        meta = dict(getattr(document, "meta", {}) or {})
        meta["tealtiger_pii"] = {
            "action": self._action,
            "finding_count": len(findings),
            "findings": [asdict(finding) for finding in findings],
        }

        kwargs: dict[str, Any] = {"content": content, "meta": meta}
        for attr in ("id", "blob", "score", "embedding", "sparse_embedding"):
            if hasattr(document, attr):
                kwargs[attr] = getattr(document, attr)

        return document.__class__(**kwargs)


def _ranges_overlap(left: range, right: range) -> bool:
    """Return True when two ranges share any character positions."""
    return left.start < right.stop and right.start < left.stop
