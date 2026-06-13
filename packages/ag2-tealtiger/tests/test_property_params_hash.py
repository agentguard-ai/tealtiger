"""Property-based test: Params Hash Determinism (Property 6).

# Feature: ag2-tealtiger-adapter, Property 6: Params Hash Determinism

Verifies that compute_params_hash (SHA-256 of JCS-canonicalized JSON) is
deterministic — the same arguments always produce the same hash, and different
arguments produce different hashes (with cryptographic probability).

**Validates: Requirements 5.5**
"""

from __future__ import annotations

import copy

import pytest
from hypothesis import given, settings, assume

from ag2_tealtiger.idempotency import compute_params_hash
from tests.strategies import tool_args


@pytest.mark.property
class TestParamsHashDeterminism:
    """Property 6: Params Hash Determinism.

    *For any* tool call arguments, computing params_hash (SHA-256 of
    JCS-canonicalized JSON) SHALL be deterministic — the same arguments
    SHALL always produce the same hash, and different arguments SHALL
    produce different hashes (with cryptographic probability).

    **Validates: Requirements 5.5**
    """

    @settings(max_examples=100, deadline=5000)
    @given(args=tool_args)
    def test_same_args_produce_same_hash(self, args: dict) -> None:
        """Same tool args always produce identical hash (determinism).

        For any tool call arguments, calling compute_params_hash multiple
        times with the same logical input must always return the same result.
        """
        hash_1 = compute_params_hash(args)
        hash_2 = compute_params_hash(args)
        assert hash_1 == hash_2, (
            f"Same args produced different hashes: {hash_1!r} != {hash_2!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(args=tool_args)
    def test_deep_copy_produces_same_hash(self, args: dict) -> None:
        """A deep copy of tool args produces the same hash as the original.

        This verifies that the hash depends only on the logical content
        of the arguments, not on object identity or memory layout.
        """
        original_hash = compute_params_hash(args)
        copied_args = copy.deepcopy(args)
        copied_hash = compute_params_hash(copied_args)
        assert original_hash == copied_hash, (
            f"Deep copy produced different hash: {original_hash!r} != {copied_hash!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(args=tool_args)
    def test_key_order_does_not_affect_hash(self, args: dict) -> None:
        """Reordering top-level keys produces the same hash.

        JCS canonicalization sorts keys, so any permutation of the same
        key-value pairs must yield an identical hash.
        """
        assume(len(args) >= 2)
        # Reverse the key order to create a differently-ordered dict
        reversed_args = dict(reversed(list(args.items())))
        assert compute_params_hash(args) == compute_params_hash(reversed_args), (
            f"Key reordering changed the hash for args with keys: {list(args.keys())}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(args_a=tool_args, args_b=tool_args)
    def test_different_args_produce_different_hashes(
        self, args_a: dict, args_b: dict
    ) -> None:
        """Different tool args produce different hashes (collision resistance).

        With cryptographic probability, two distinct inputs to SHA-256
        should never produce the same digest.
        """
        assume(args_a != args_b)
        hash_a = compute_params_hash(args_a)
        hash_b = compute_params_hash(args_b)
        assert hash_a != hash_b, (
            f"Different args produced same hash {hash_a!r}: "
            f"args_a={args_a!r}, args_b={args_b!r}"
        )

    @settings(max_examples=100, deadline=5000)
    @given(args=tool_args)
    def test_hash_is_valid_sha256_hex(self, args: dict) -> None:
        """The hash is always a valid 64-character lowercase hex string (SHA-256).

        This ensures the output format is consistent and well-formed.
        """
        result = compute_params_hash(args)
        assert len(result) == 64, f"Expected 64 chars, got {len(result)}"
        assert all(c in "0123456789abcdef" for c in result), (
            f"Hash contains non-hex characters: {result!r}"
        )
