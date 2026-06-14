"""Tests for TealTigerPIIRedactor."""

from __future__ import annotations

import pytest
from haystack import Document

from haystack_integrations.components.connectors.tealtiger import TealTigerPIIRedactor


def test_redact_mode_replaces_pii_after_retrieval() -> None:
    """Redact mode replaces PII in retrieved documents before generation."""
    documents = [
        Document(
            content=(
                "Customer jane@example.com has SSN 123-45-6789, "
                "card 4111-1111-1111-1111, phone (555) 123-4567, "
                "and API key sk-test1234567890abcdef."
            ),
            meta={"source": "crm"},
        )
    ]
    redactor = TealTigerPIIRedactor(action="redact")

    result = redactor.run(documents=documents)

    clean_document = result["clean_documents"][0]
    clean_text = clean_document.content or ""
    assert "jane@example.com" not in clean_text
    assert "123-45-6789" not in clean_text
    assert "4111-1111-1111-1111" not in clean_text
    assert "(555) 123-4567" not in clean_text
    assert "sk-test1234567890abcdef" not in clean_text
    assert clean_text.count("[REDACTED]") == 5
    assert clean_document.meta["source"] == "crm"
    assert clean_document.meta["tealtiger_pii"]["action"] == "redact"
    assert clean_document.meta["tealtiger_pii"]["finding_count"] == 5
    assert result["summary"]["documents_processed"] == 1
    assert result["summary"]["findings_total"] == 5


def test_flag_mode_records_findings_without_changing_document_content() -> None:
    """Flag mode records PII findings while leaving retrieved content unchanged."""
    original_text = "Reach the customer at alice@example.com or 555-123-4567."
    redactor = TealTigerPIIRedactor(action="flag")

    result = redactor.run(documents=[Document(content=original_text)])

    clean_document = result["clean_documents"][0]
    assert clean_document.content == original_text
    assert clean_document.meta["tealtiger_pii"]["action"] == "flag"
    assert clean_document.meta["tealtiger_pii"]["finding_count"] == 2
    assert {finding["type"] for finding in result["summary"]["findings"]} == {
        "email",
        "phone_number",
    }


def test_redactor_rejects_unknown_action() -> None:
    """Only redact and flag actions are valid."""
    with pytest.raises(ValueError, match="action must be one of"):
        TealTigerPIIRedactor(action="block")


def test_pii_type_subset_limits_detection() -> None:
    """Optional pii_types narrows the detector to selected finding types."""
    redactor = TealTigerPIIRedactor(pii_types=["email"])

    result = redactor.run(
        documents=[Document(content="Email jane@example.com and SSN 123-45-6789.")]
    )

    clean_text = result["clean_documents"][0].content or ""
    assert "jane@example.com" not in clean_text
    assert "123-45-6789" in clean_text
    assert result["summary"]["findings_total"] == 1
    assert result["summary"]["findings"][0]["type"] == "email"


def test_redactor_rejects_unknown_pii_type() -> None:
    """Unknown detector names are rejected early."""
    with pytest.raises(ValueError, match="unknown pii_types"):
        TealTigerPIIRedactor(pii_types=["passport"])


def test_overlapping_api_key_patterns_are_reported_once() -> None:
    """Overlapping API-key patterns do not duplicate redactions."""
    redactor = TealTigerPIIRedactor()

    result = redactor.run(documents=[Document(content="api_key=sk-test1234567890abcdef")])

    assert result["clean_documents"][0].content == "[REDACTED]"
    assert result["summary"]["findings_total"] == 1
    assert result["summary"]["findings"][0]["type"] == "api_key"
