"""Idempotency key and params hash utilities for ag2-tealtiger.

Provides deterministic hash computation for tool call arguments and
idempotency key derivation for downstream tool deduplication.
"""

from __future__ import annotations

import hashlib
import json


def compute_params_hash(tool_args: dict) -> str:
    """Compute SHA-256 of JCS-canonicalized (RFC 8785) tool arguments.

    Uses sorted keys and compact separators for canonical JSON serialization,
    ensuring the same logical arguments always produce the same hash regardless
    of original key ordering or whitespace.

    Args:
        tool_args: Dictionary of tool call parameters to hash.

    Returns:
        Hex-encoded SHA-256 digest of the canonical JSON representation.
    """
    canonical = json.dumps(tool_args, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def derive_idempotency_key(decision_id: str, params_hash: str) -> str:
    """Derive idempotency key from decision_id and params_hash.

    The key is deterministic: same inputs always produce the same output.
    Used for downstream tool deduplication to prevent duplicate side effects
    on retries.

    Args:
        decision_id: Unique identifier for the governance decision instance.
        params_hash: SHA-256 hash of the tool call parameters (from compute_params_hash).

    Returns:
        Hex-encoded SHA-256 digest of the combined decision_id:params_hash string.
    """
    combined = f"{decision_id}:{params_hash}"
    return hashlib.sha256(combined.encode("utf-8")).hexdigest()
