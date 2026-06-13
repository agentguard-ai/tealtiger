"""Property-based test: Idempotency Key Determinism (Property 8).

# Feature: ag2-tealtiger-adapter, Property 8: Idempotency Key Determinism

*For any* decision_id and params_hash pair, the derived idempotency_key SHALL be
deterministic — the same inputs always produce the same key.

**Validates: Requirements 5.8, 11.2**
"""

from __future__ import annotations

import uuid as uuid_mod

import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from ag2_tealtiger.idempotency import derive_idempotency_key

# Fast strategies for UUID v4 and SHA-256 hashes (avoid slow from_regex)
_fast_uuids = st.builds(lambda: str(uuid_mod.uuid4()))
_fast_sha256 = st.binary(min_size=32, max_size=32).map(lambda b: b.hex())


@pytest.mark.property
class TestIdempotencyKeyDeterminism:
    """Property 8: Idempotency Key Determinism.

    For any decision_id and params_hash pair, calling derive_idempotency_key
    multiple times with the same inputs SHALL always produce the same output.
    """

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(decision_id=_fast_uuids, params_hash=_fast_sha256)
    def test_same_inputs_produce_same_key(
        self, decision_id: str, params_hash: str
    ) -> None:
        """Validates: Requirements 5.8, 11.2

        The idempotency_key derived from a given decision_id and params_hash
        pair is deterministic — invoking derive_idempotency_key multiple times
        with the same inputs always returns the same result.
        """
        key_1 = derive_idempotency_key(decision_id, params_hash)
        key_2 = derive_idempotency_key(decision_id, params_hash)
        key_3 = derive_idempotency_key(decision_id, params_hash)

        assert key_1 == key_2
        assert key_2 == key_3

    @settings(max_examples=100, suppress_health_check=[HealthCheck.too_slow])
    @given(decision_id=_fast_uuids, params_hash=_fast_sha256)
    def test_idempotency_key_is_valid_sha256_hex(
        self, decision_id: str, params_hash: str
    ) -> None:
        """Validates: Requirements 5.8, 11.2

        The derived idempotency_key SHALL be a valid 64-character hex-encoded
        SHA-256 digest for all valid decision_id and params_hash inputs.
        """
        key = derive_idempotency_key(decision_id, params_hash)

        assert len(key) == 64
        assert all(c in "0123456789abcdef" for c in key)
