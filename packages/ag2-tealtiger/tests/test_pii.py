"""Unit tests for PII detection module.

Tests regex-based PII pattern matching for email, phone_number,
ssn, credit_card, and ip_address types across plain strings,
dicts, and nested data structures.
"""

from __future__ import annotations

import pytest

from ag2_tealtiger.pii import detect_pii, detect_pii_in_text


class TestEmailDetection:
    """Tests for email address PII detection."""

    def test_simple_email(self) -> None:
        results = detect_pii("Contact me at user@example.com please")
        assert len(results) == 1
        assert results[0]["type"] == "email"
        assert results[0]["value"] == "user@example.com"
        assert results[0]["confidence"] == 0.95

    def test_email_with_subdomain(self) -> None:
        results = detect_pii("Send to admin@mail.company.co.uk")
        assert len(results) == 1
        assert results[0]["type"] == "email"
        assert results[0]["value"] == "admin@mail.company.co.uk"

    def test_email_with_plus_addressing(self) -> None:
        results = detect_pii("Use user+tag@gmail.com for filtering")
        assert len(results) == 1
        assert results[0]["type"] == "email"
        assert results[0]["value"] == "user+tag@gmail.com"

    def test_multiple_emails(self) -> None:
        text = "From alice@test.com to bob@example.org"
        results = detect_pii(text)
        emails = [r for r in results if r["type"] == "email"]
        assert len(emails) == 2

    def test_no_email(self) -> None:
        results = detect_pii("No email here, just text")
        emails = [r for r in results if r["type"] == "email"]
        assert len(emails) == 0


class TestPhoneNumberDetection:
    """Tests for phone number PII detection."""

    def test_us_phone_dashes(self) -> None:
        results = detect_pii("Call me at 555-123-4567")
        phones = [r for r in results if r["type"] == "phone_number"]
        assert len(phones) == 1
        assert phones[0]["value"] == "555-123-4567"
        assert phones[0]["confidence"] == 0.80

    def test_us_phone_dots(self) -> None:
        results = detect_pii("Phone: 555.123.4567")
        phones = [r for r in results if r["type"] == "phone_number"]
        assert len(phones) == 1
        assert phones[0]["value"] == "555.123.4567"

    def test_us_phone_parentheses(self) -> None:
        results = detect_pii("Phone: (555) 123-4567")
        phones = [r for r in results if r["type"] == "phone_number"]
        assert len(phones) == 1
        assert "(555)" in phones[0]["value"]

    def test_us_phone_with_country_code(self) -> None:
        results = detect_pii("International: +1-555-123-4567")
        phones = [r for r in results if r["type"] == "phone_number"]
        assert len(phones) == 1
        assert "+1-" in phones[0]["value"]

    def test_no_phone(self) -> None:
        results = detect_pii("Just a regular sentence")
        phones = [r for r in results if r["type"] == "phone_number"]
        assert len(phones) == 0


class TestSSNDetection:
    """Tests for Social Security Number PII detection."""

    def test_standard_ssn(self) -> None:
        results = detect_pii("SSN: 123-45-6789")
        ssns = [r for r in results if r["type"] == "ssn"]
        assert len(ssns) == 1
        assert ssns[0]["value"] == "123-45-6789"
        assert ssns[0]["confidence"] == 0.99

    def test_ssn_in_text(self) -> None:
        results = detect_pii("My social is 987-65-4321, don't share it")
        ssns = [r for r in results if r["type"] == "ssn"]
        assert len(ssns) == 1
        assert ssns[0]["value"] == "987-65-4321"

    def test_no_ssn(self) -> None:
        results = detect_pii("Phone: 555-1234 and zip: 90210")
        ssns = [r for r in results if r["type"] == "ssn"]
        assert len(ssns) == 0


class TestCreditCardDetection:
    """Tests for credit card number PII detection."""

    def test_credit_card_spaces(self) -> None:
        results = detect_pii("Card: 4111 1111 1111 1111")
        cards = [r for r in results if r["type"] == "credit_card"]
        assert len(cards) == 1
        assert cards[0]["value"] == "4111 1111 1111 1111"
        assert cards[0]["confidence"] == 0.90

    def test_credit_card_dashes(self) -> None:
        results = detect_pii("Payment: 5500-0000-0000-0004")
        cards = [r for r in results if r["type"] == "credit_card"]
        assert len(cards) == 1
        assert cards[0]["value"] == "5500-0000-0000-0004"

    def test_credit_card_no_separator(self) -> None:
        results = detect_pii("CC: 4111111111111111")
        cards = [r for r in results if r["type"] == "credit_card"]
        assert len(cards) == 1
        assert cards[0]["value"] == "4111111111111111"

    def test_no_credit_card(self) -> None:
        results = detect_pii("Order number 12345")
        cards = [r for r in results if r["type"] == "credit_card"]
        assert len(cards) == 0


class TestIPAddressDetection:
    """Tests for IP address PII detection."""

    def test_standard_ip(self) -> None:
        results = detect_pii("Server at 192.168.1.100")
        ips = [r for r in results if r["type"] == "ip_address"]
        assert len(ips) == 1
        assert ips[0]["value"] == "192.168.1.100"
        assert ips[0]["confidence"] == 0.70

    def test_localhost_ip(self) -> None:
        results = detect_pii("Connect to 127.0.0.1")
        ips = [r for r in results if r["type"] == "ip_address"]
        assert len(ips) == 1
        assert ips[0]["value"] == "127.0.0.1"

    def test_boundary_ip(self) -> None:
        results = detect_pii("Range: 255.255.255.255")
        ips = [r for r in results if r["type"] == "ip_address"]
        assert len(ips) == 1
        assert ips[0]["value"] == "255.255.255.255"

    def test_invalid_ip_not_detected(self) -> None:
        results = detect_pii("Not an IP: 999.999.999.999")
        ips = [r for r in results if r["type"] == "ip_address"]
        assert len(ips) == 0

    def test_no_ip(self) -> None:
        results = detect_pii("Version 3.10.2 is out")
        ips = [r for r in results if r["type"] == "ip_address"]
        assert len(ips) == 0


class TestRecursiveScanning:
    """Tests for recursive dict/list scanning."""

    def test_flat_dict(self) -> None:
        data = {"email": "user@example.com", "name": "Alice"}
        results = detect_pii(data)
        assert len(results) == 1
        assert results[0]["type"] == "email"
        assert results[0]["location"] == "email"

    def test_nested_dict(self) -> None:
        data = {
            "user": {
                "contact": {
                    "email": "admin@corp.io",
                }
            }
        }
        results = detect_pii(data)
        assert len(results) == 1
        assert results[0]["type"] == "email"
        assert results[0]["location"] == "user.contact.email"

    def test_list_values(self) -> None:
        data = ["user@a.com", "nothing here", "other@b.org"]
        results = detect_pii(data)
        emails = [r for r in results if r["type"] == "email"]
        assert len(emails) == 2
        assert emails[0]["location"] == "[0]"
        assert emails[1]["location"] == "[2]"

    def test_dict_with_list(self) -> None:
        data = {
            "recipients": ["alice@test.com", "bob@test.com"],
            "body": "No PII here",
        }
        results = detect_pii(data)
        emails = [r for r in results if r["type"] == "email"]
        assert len(emails) == 2
        assert emails[0]["location"] == "recipients[0]"
        assert emails[1]["location"] == "recipients[1]"

    def test_mixed_types_in_dict(self) -> None:
        data = {
            "count": 42,
            "active": True,
            "email": "test@example.com",
            "nothing": None,
        }
        results = detect_pii(data)
        assert len(results) == 1
        assert results[0]["type"] == "email"

    def test_deeply_nested(self) -> None:
        data = {
            "level1": {
                "level2": [
                    {"ssn": "123-45-6789"},
                ]
            }
        }
        results = detect_pii(data)
        assert len(results) == 1
        assert results[0]["type"] == "ssn"
        assert results[0]["location"] == "level1.level2[0].ssn"

    def test_empty_structures(self) -> None:
        assert detect_pii({}) == []
        assert detect_pii([]) == []
        assert detect_pii("") == []


class TestMultiplePIITypes:
    """Tests for detecting multiple PII types in the same input."""

    def test_multiple_types_in_string(self) -> None:
        text = "Email: user@test.com, SSN: 123-45-6789, IP: 10.0.0.1"
        results = detect_pii(text)
        types_found = {r["type"] for r in results}
        assert "email" in types_found
        assert "ssn" in types_found
        assert "ip_address" in types_found

    def test_multiple_types_in_dict(self) -> None:
        data = {
            "email": "admin@corp.com",
            "phone": "555-123-4567",
            "ssn": "111-22-3333",
            "card": "4111 1111 1111 1111",
            "server": "192.168.0.1",
        }
        results = detect_pii(data)
        types_found = {r["type"] for r in results}
        assert types_found == {"email", "phone_number", "ssn", "credit_card", "ip_address"}


class TestDetectPIIInText:
    """Tests for the detect_pii_in_text helper function."""

    def test_with_location(self) -> None:
        results = detect_pii_in_text("user@test.com", location="args.email")
        assert len(results) == 1
        assert results[0]["location"] == "args.email"

    def test_without_location(self) -> None:
        results = detect_pii_in_text("user@test.com")
        assert len(results) == 1
        assert results[0]["location"] == ""

    def test_no_match(self) -> None:
        results = detect_pii_in_text("just plain text")
        assert results == []


class TestResultStructure:
    """Tests for the structure of detection result dicts."""

    def test_result_has_required_fields(self) -> None:
        results = detect_pii("user@example.com")
        assert len(results) == 1
        result = results[0]
        assert "type" in result
        assert "value" in result
        assert "location" in result
        assert "confidence" in result
        assert "start" in result
        assert "end" in result

    def test_start_end_positions(self) -> None:
        text = "Hello user@test.com world"
        results = detect_pii(text)
        assert len(results) == 1
        result = results[0]
        assert text[result["start"]:result["end"]] == "user@test.com"

    def test_confidence_range(self) -> None:
        data = {
            "email": "a@b.com",
            "phone": "555-123-4567",
            "ssn": "123-45-6789",
            "card": "4111111111111111",
            "ip": "10.0.0.1",
        }
        results = detect_pii(data)
        for result in results:
            assert 0.0 < result["confidence"] <= 1.0
