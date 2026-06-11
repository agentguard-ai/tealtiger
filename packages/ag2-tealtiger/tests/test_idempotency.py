"""Unit tests for idempotency key and params hash utilities."""

from __future__ import annotations

import hashlib
import json

from ag2_tealtiger.idempotency import compute_params_hash, derive_idempotency_key


class TestComputeParamsHash:
    """Tests for compute_params_hash function."""

    def test_empty_dict(self) -> None:
        """Empty dict produces consistent hash."""
        result = compute_params_hash({})
        expected = hashlib.sha256(b"{}").hexdigest()
        assert result == expected

    def test_deterministic_same_input(self) -> None:
        """Same input always produces same hash."""
        args = {"tool": "search", "query": "hello world"}
        assert compute_params_hash(args) == compute_params_hash(args)

    def test_key_order_independent(self) -> None:
        """Different key orderings produce the same hash."""
        args_a = {"b": 2, "a": 1}
        args_b = {"a": 1, "b": 2}
        assert compute_params_hash(args_a) == compute_params_hash(args_b)

    def test_different_args_different_hash(self) -> None:
        """Different arguments produce different hashes."""
        args_a = {"query": "hello"}
        args_b = {"query": "world"}
        assert compute_params_hash(args_a) != compute_params_hash(args_b)

    def test_nested_dict_sorted(self) -> None:
        """Nested dicts have keys sorted at all levels."""
        args_a = {"outer": {"z": 1, "a": 2}}
        args_b = {"outer": {"a": 2, "z": 1}}
        assert compute_params_hash(args_a) == compute_params_hash(args_b)

    def test_compact_separators(self) -> None:
        """Hash uses compact separators (no whitespace)."""
        args = {"key": "value"}
        canonical = json.dumps(args, sort_keys=True, separators=(",", ":"))
        expected = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        assert compute_params_hash(args) == expected

    def test_returns_hex_string(self) -> None:
        """Result is a valid hex-encoded SHA-256 digest (64 chars)."""
        result = compute_params_hash({"x": 1})
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_various_value_types(self) -> None:
        """Works with various JSON-serializable value types."""
        args = {
            "string": "hello",
            "number": 42,
            "float": 3.14,
            "bool": True,
            "null": None,
            "list": [1, 2, 3],
        }
        result = compute_params_hash(args)
        assert len(result) == 64


class TestDeriveIdempotencyKey:
    """Tests for derive_idempotency_key function."""

    def test_deterministic_same_inputs(self) -> None:
        """Same decision_id + params_hash always produces same key."""
        decision_id = "dec-123"
        params_hash = "abc123"
        result_1 = derive_idempotency_key(decision_id, params_hash)
        result_2 = derive_idempotency_key(decision_id, params_hash)
        assert result_1 == result_2

    def test_different_decision_id_different_key(self) -> None:
        """Different decision_ids produce different keys."""
        params_hash = "abc123"
        key_a = derive_idempotency_key("dec-1", params_hash)
        key_b = derive_idempotency_key("dec-2", params_hash)
        assert key_a != key_b

    def test_different_params_hash_different_key(self) -> None:
        """Different params_hashes produce different keys."""
        decision_id = "dec-123"
        key_a = derive_idempotency_key(decision_id, "hash-a")
        key_b = derive_idempotency_key(decision_id, "hash-b")
        assert key_a != key_b

    def test_returns_hex_string(self) -> None:
        """Result is a valid hex-encoded SHA-256 digest (64 chars)."""
        result = derive_idempotency_key("dec-1", "hash-1")
        assert len(result) == 64
        assert all(c in "0123456789abcdef" for c in result)

    def test_combines_with_colon_separator(self) -> None:
        """Key is derived from 'decision_id:params_hash' format."""
        decision_id = "my-decision"
        params_hash = "my-hash"
        combined = f"{decision_id}:{params_hash}"
        expected = hashlib.sha256(combined.encode("utf-8")).hexdigest()
        assert derive_idempotency_key(decision_id, params_hash) == expected
