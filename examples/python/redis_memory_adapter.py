"""Redis-backed TealMemory adapter example.

This example mirrors the TypeScript MemoryAdapter contract with a Python
Protocol because the Python SDK currently exposes memory detectors but not a
formal TealMemory adapter interface.

It demonstrates the same governance shape:
- write governance scans for secrets before Redis writes;
- read governance enforces memory scope before Redis reads;
- Redis PX expiry stores the accepted TTL at the storage layer.

Install the standard Redis Python client before running:

    pip install redis

Run with a local Redis server:

    REDIS_URL=redis://localhost:6379 python examples/python/redis_memory_adapter.py
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Protocol

from redis.asyncio import Redis, from_url


MemoryScope = str
Classification = str

SECRET_PATTERNS = [
    re.compile(r"(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,}", re.I),
    re.compile(r"ghp_[A-Za-z0-9]{36}"),
    re.compile(r"sk_live_[A-Za-z0-9]{24,}"),
    re.compile(r"Bearer\s+[A-Za-z0-9\-._~+/]+=*"),
]


@dataclass
class MemoryRecord:
    scope: MemoryScope
    classification: Classification
    value: str
    ttl_ms: Optional[int] = None
    id: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    source: Optional[str] = None


@dataclass
class MemoryQuery:
    scope: MemoryScope
    tags: List[str] = field(default_factory=list)
    prefix: Optional[str] = None
    contains: Optional[str] = None
    max_results: Optional[int] = None


@dataclass
class MemoryDelete:
    scope: MemoryScope
    id: Optional[str] = None
    tags: List[str] = field(default_factory=list)


@dataclass
class MemoryOperationContext:
    correlation_id: str
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None
    session_id: Optional[str] = None


class MemoryAdapter(Protocol):
    async def put(self, record: MemoryRecord, ctx: MemoryOperationContext) -> str:
        """Store a governed memory record and return its ID."""

    async def get(self, query: MemoryQuery, ctx: MemoryOperationContext) -> List[MemoryRecord]:
        """Read governed memory records matching a scope and optional selector."""

    async def delete(self, selector: MemoryDelete, ctx: MemoryOperationContext) -> None:
        """Delete governed memory records matching a scope and optional selector."""


class RedisMemoryAdapter:
    """MemoryAdapter implementation backed by redis-py asyncio."""

    def __init__(self, redis: Redis, namespace: str = "tealtiger:memory") -> None:
        self.redis = redis
        self.namespace = namespace

    async def put(self, record: MemoryRecord, ctx: MemoryOperationContext) -> str:
        record_id = record.id or str(uuid.uuid4())
        stored = {
            **asdict(record),
            "id": record_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": ctx.tenant_id,
            "user_id": ctx.user_id,
            "session_id": ctx.session_id,
        }
        key = self._record_key(ctx, record.scope, record_id)
        index_key = self._scope_index_key(ctx, record.scope)

        if record.ttl_ms and record.ttl_ms > 0:
            await self.redis.set(key, json.dumps(stored), px=record.ttl_ms)
        else:
            await self.redis.set(key, json.dumps(stored))

        await self.redis.sadd(index_key, record_id)
        return record_id

    async def get(self, query: MemoryQuery, ctx: MemoryOperationContext) -> List[MemoryRecord]:
        ids = await self.redis.smembers(self._scope_index_key(ctx, query.scope))
        records: List[MemoryRecord] = []
        max_results = query.max_results or float("inf")

        for raw_id in ids:
            if len(records) >= max_results:
                break

            record_id = raw_id.decode() if isinstance(raw_id, bytes) else str(raw_id)
            key = self._record_key(ctx, query.scope, record_id)
            raw_record = await self.redis.get(key)

            if raw_record is None:
                await self.redis.srem(self._scope_index_key(ctx, query.scope), record_id)
                continue

            payload = json.loads(raw_record)
            record = self._to_memory_record(payload)
            if self._matches_query(record, query):
                records.append(record)

        return records

    async def delete(self, selector: MemoryDelete, ctx: MemoryOperationContext) -> None:
        if selector.id:
            ids = [selector.id]
        else:
            raw_ids = await self.redis.smembers(self._scope_index_key(ctx, selector.scope))
            ids = [raw.decode() if isinstance(raw, bytes) else str(raw) for raw in raw_ids]

        index_key = self._scope_index_key(ctx, selector.scope)
        for record_id in ids:
            key = self._record_key(ctx, selector.scope, record_id)
            raw_record = await self.redis.get(key)
            if raw_record is None:
                await self.redis.srem(index_key, record_id)
                continue

            record = self._to_memory_record(json.loads(raw_record))
            if not self._matches_delete(record, selector):
                continue

            await self.redis.delete(key)
            await self.redis.srem(index_key, record_id)

    async def ttl_ms(self, record_id: str, scope: MemoryScope, ctx: MemoryOperationContext) -> int:
        """Expose Redis PTTL for the example output."""
        return int(await self.redis.pttl(self._record_key(ctx, scope, record_id)))

    def _context_key(self, ctx: MemoryOperationContext) -> str:
        tenant = ctx.tenant_id or "tenant:none"
        user = ctx.user_id or "user:none"
        session = ctx.session_id or "session:none"
        return f"{tenant}:{user}:{session}"

    def _scope_index_key(self, ctx: MemoryOperationContext, scope: MemoryScope) -> str:
        return f"{self.namespace}:{self._context_key(ctx)}:{scope}:ids"

    def _record_key(self, ctx: MemoryOperationContext, scope: MemoryScope, record_id: str) -> str:
        return f"{self.namespace}:{self._context_key(ctx)}:{scope}:{record_id}"

    def _to_memory_record(self, payload: Dict[str, Any]) -> MemoryRecord:
        return MemoryRecord(
            id=payload.get("id"),
            scope=payload["scope"],
            classification=payload["classification"],
            value=payload["value"],
            ttl_ms=payload.get("ttl_ms"),
            tags=payload.get("tags") or [],
            source=payload.get("source"),
        )

    def _matches_query(self, record: MemoryRecord, query: MemoryQuery) -> bool:
        if record.scope != query.scope:
            return False
        if query.tags and not any(tag in record.tags for tag in query.tags):
            return False
        if query.prefix and not record.value.startswith(query.prefix):
            return False
        if query.contains and query.contains not in record.value:
            return False
        return True

    def _matches_delete(self, record: MemoryRecord, selector: MemoryDelete) -> bool:
        if record.scope != selector.scope:
            return False
        if selector.id and record.id != selector.id:
            return False
        if selector.tags and not any(tag in record.tags for tag in selector.tags):
            return False
        return True


class TealMemoryGovernance:
    """Small governance wrapper around the adapter for this example."""

    def __init__(
        self,
        adapter: MemoryAdapter,
        allowed_write_scopes: List[MemoryScope],
        allowed_read_scopes: List[MemoryScope],
        ttl_required_for: List[Classification],
        max_ttl_ms: int,
    ) -> None:
        self.adapter = adapter
        self.allowed_write_scopes = allowed_write_scopes
        self.allowed_read_scopes = allowed_read_scopes
        self.ttl_required_for = ttl_required_for
        self.max_ttl_ms = max_ttl_ms

    async def write(self, record: MemoryRecord, ctx: MemoryOperationContext) -> Dict[str, Any]:
        if record.scope not in self.allowed_write_scopes:
            return self._deny("DENY_WRITE", "MEMORY_SCOPE_VIOLATION", "Write denied: scope not allowed")

        if record.classification in self.ttl_required_for and not record.ttl_ms:
            return self._deny("DENY_WRITE", "MEMORY_TTL_REQUIRED", "Write denied: TTL required")

        if record.ttl_ms and record.ttl_ms > self.max_ttl_ms:
            return self._deny("DENY_WRITE", "MEMORY_TTL_EXCEEDED", "Write denied: TTL too long")

        if self._contains_secret(record.value):
            return self._deny("DENY_WRITE", "MEMORY_WRITE_DENIED_SECRET", "Write denied: secret detected")

        record_id = await self.adapter.put(record, ctx)
        return {
            "action": "ALLOW_WRITE",
            "reason_codes": ["MEMORY_WRITE_ALLOWED"],
            "record_id": record_id,
        }

    async def read(self, query: MemoryQuery, ctx: MemoryOperationContext) -> Dict[str, Any]:
        if query.scope not in self.allowed_read_scopes:
            return self._deny("DENY_READ", "MEMORY_READ_DENIED_SCOPE", "Read denied: scope not allowed")

        records = await self.adapter.get(query, ctx)
        return {
            "action": "ALLOW",
            "reason_codes": ["MEMORY_READ_ALLOWED"],
            "records": records,
        }

    def _contains_secret(self, value: str) -> bool:
        return any(pattern.search(value) for pattern in SECRET_PATTERNS)

    def _deny(self, action: str, reason_code: str, reason: str) -> Dict[str, Any]:
        return {
            "action": action,
            "reason_codes": [reason_code],
            "reason": reason,
        }


async def main() -> None:
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    redis = from_url(redis_url, decode_responses=True)
    await redis.ping()

    adapter = RedisMemoryAdapter(redis)
    memory = TealMemoryGovernance(
        adapter=adapter,
        allowed_write_scopes=["SESSION", "USER"],
        allowed_read_scopes=["SESSION"],
        ttl_required_for=["CONFIDENTIAL", "RESTRICTED"],
        max_ttl_ms=60_000,
    )
    ctx = MemoryOperationContext(
        correlation_id="redis-memory-demo",
        tenant_id="tenant-acme",
        user_id="user-42",
        session_id="session-123",
    )

    print("\n--- Write governance: secret scanning happens before Redis writes ---")
    secret_write = await memory.write(
        MemoryRecord(
            scope="SESSION",
            classification="CONFIDENTIAL",
            ttl_ms=30_000,
            value="api_key=sk_live_this_should_not_be_stored",
            tags=["support-case"],
            source="MODEL",
        ),
        ctx,
    )
    print(secret_write["action"], secret_write["reason_codes"])

    print("\n--- TTL enforcement: accepted records use Redis PX expiry ---")
    clean_write = await memory.write(
        MemoryRecord(
            scope="SESSION",
            classification="CONFIDENTIAL",
            ttl_ms=30_000,
            value="Customer prefers email updates about ticket 123.",
            tags=["support-case"],
            source="USER",
        ),
        ctx,
    )
    print(clean_write["action"], clean_write["reason_codes"])
    ttl = await adapter.ttl_ms(clean_write["record_id"], "SESSION", ctx)
    print("Redis TTL remaining (ms):", ttl)

    print("\n--- Read governance: allowed SESSION scope returns Redis records ---")
    allowed_read = await memory.read(MemoryQuery(scope="SESSION", tags=["support-case"]), ctx)
    print(allowed_read["action"], allowed_read["reason_codes"])
    print("Records returned:", len(allowed_read["records"]))

    print("\n--- Read governance: disallowed GLOBAL scope is denied before Redis reads ---")
    denied_read = await memory.read(MemoryQuery(scope="GLOBAL"), ctx)
    print(denied_read["action"], denied_read["reason_codes"])

    await redis.aclose()


if __name__ == "__main__":
    asyncio.run(main())
