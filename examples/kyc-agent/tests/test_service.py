"""HTTP contract tests for the deterministic KYC demo service."""

import asyncio

import httpx
import pytest

from agents import document_extractor
from service import app


def _request(method: str, path: str, **kwargs) -> httpx.Response:
    async def send() -> httpx.Response:
        transport = httpx.ASGITransport(app=app, raise_app_exceptions=False)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            return await client.request(method, path, **kwargs)

    return asyncio.run(send())


def test_health_reports_the_service_is_ready():
    """Breaks if the deployable service has no usable readiness endpoint."""
    response = _request("GET", "/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_extract_exposes_deterministic_identity_fields():
    """Breaks if the container service cannot invoke the local extractor."""
    response = _request(
        "POST",
        "/extract",
        json={
            "document": {
                "document_type": "passport",
                "extracted_fields": {
                    "first_name": "Jane",
                    "last_name": "Testcase",
                    "date_of_birth": "1985-03-15",
                    "nationality": "ZZ",
                    "document_number": "ZZ-TEST-000001",
                    "document_expiry": "2029-01-01",
                },
            }
        },
    )

    assert response.status_code == 200
    assert response.json()["identity"] == {
        "first_name": "Jane",
        "last_name": "Testcase",
        "date_of_birth": "1985-03-15",
        "nationality": "ZZ",
        "document_type": "passport",
        "document_number": "ZZ-TEST-000001",
        "document_expiry": "2029-01-01",
        "address": None,
        "confidence": 1.0,
    }


def test_extract_ignores_llm_environment_settings(monkeypatch):
    """Breaks if this local deployment can invoke an LLM with document data."""
    llm_was_called = False

    async def unexpected_llm(*_args, **_kwargs):
        nonlocal llm_was_called
        llm_was_called = True
        raise AssertionError("the local demo must not invoke an LLM")

    monkeypatch.setenv("USE_LLM", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "not-a-real-key")
    monkeypatch.setattr(document_extractor, "_extract_with_llm", unexpected_llm)

    response = _request(
        "POST",
        "/extract",
        json={"document": {"first_name": "Jane", "last_name": "Testcase"}},
    )

    assert response.status_code == 200
    assert llm_was_called is False


def test_sanctions_uses_the_bundled_synthetic_list():
    """Breaks if the container service cannot access its local fixture data."""
    response = _request(
        "POST",
        "/sanctions",
        json={
            "name": "Ivan Testovich Fixture",
            "dob": "1961-02-02",
            "nationality": "ZZ",
        },
    )

    assert response.status_code == 200
    assert response.json()["result"] == {
        "status": "exact_match",
        "confidence": 1.0,
        "matched_entity": "Ivan Testovich Fixture",
        "list_source": "OFAC_SDN",
    }


def test_invalid_requests_do_not_echo_document_content():
    """Breaks if validation errors leak raw identity-document input."""
    response = _request(
        "POST",
        "/extract",
        json={"document": "sensitive-document-content-must-not-be-returned"},
    )

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/extract", {"document": {}}),
        ("/sanctions", {"name": "   "}),
    ],
)
def test_domain_invalid_requests_return_a_sanitized_422(path: str, payload: dict) -> None:
    """Breaks if known invalid agent inputs escape as server errors."""
    response = _request("POST", path, json=payload)

    assert response.status_code == 422
    assert response.json() == {"detail": "Invalid request"}
