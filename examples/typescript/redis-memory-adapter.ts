/**
 * Redis-backed TealMemory adapter example.
 *
 * This file shows the adapter pattern TealMemory expects:
 * - Redis stores only records that pass TealMemory write governance.
 * - TealMemory performs secret scanning before calling adapter.put().
 * - TealMemory performs read scope checks before calling adapter.get().
 * - Redis PX expiry enforces the accepted ttlMs value at the storage layer.
 *
 * Install the example dependencies from the repository root before running:
 *
 *   npm install redis ts-node typescript
 *
 * Run with a local Redis server:
 *
 *   REDIS_URL=redis://localhost:6379 npx ts-node examples/typescript/redis-memory-adapter.ts
 */

import { randomUUID } from 'crypto';
import { createClient } from 'redis';
import {
  TealMemory,
  type MemoryAdapter,
  type MemoryDelete,
  type MemoryOperationContext,
  type MemoryQuery,
  type MemoryRecord,
  type MemoryScope,
  type TealMemoryPolicy,
} from '../../packages/tealtiger-sdk/src/memory';

type RedisClient = ReturnType<typeof createClient>;

type StoredMemoryRecord = MemoryRecord & {
  id: string;
  createdAt: string;
  tenant_id?: string;
  user_id?: string;
  session_id?: string;
};

class RedisMemoryAdapter implements MemoryAdapter {
  constructor(
    private readonly redis: RedisClient,
    private readonly namespace = 'tealtiger:memory',
  ) {}

  async put(record: MemoryRecord, ctx: MemoryOperationContext): Promise<{ id: string }> {
    const id = record.id ?? randomUUID();
    const stored: StoredMemoryRecord = {
      ...record,
      id,
      createdAt: new Date().toISOString(),
      ...(ctx.tenant_id ? { tenant_id: ctx.tenant_id } : {}),
      ...(ctx.user_id ? { user_id: ctx.user_id } : {}),
      ...(ctx.session_id ? { session_id: ctx.session_id } : {}),
    };

    const key = this.recordKey(ctx, record.scope, id);
    const indexKey = this.scopeIndexKey(ctx, record.scope);
    const serialized = JSON.stringify(stored);
    const transaction = this.redis.multi();

    if (record.ttlMs && record.ttlMs > 0) {
      transaction.set(key, serialized, { PX: record.ttlMs });
    } else {
      transaction.set(key, serialized);
    }

    transaction.sAdd(indexKey, id);
    await transaction.exec();

    return { id };
  }

  async get(query: MemoryQuery, ctx: MemoryOperationContext): Promise<MemoryRecord[]> {
    const ids = await this.redis.sMembers(this.scopeIndexKey(ctx, query.scope));
    const records: MemoryRecord[] = [];
    const maxResults = query.maxResults ?? Number.POSITIVE_INFINITY;

    for (const rawId of ids) {
      if (records.length >= maxResults) break;

      const id = this.decodeRedisValue(rawId);
      const key = this.recordKey(ctx, query.scope, id);
      const serialized = await this.redis.get(key);

      if (!serialized) {
        // The Redis key may have expired while the index member remains.
        await this.redis.sRem(this.scopeIndexKey(ctx, query.scope), id);
        continue;
      }

      const record = JSON.parse(this.decodeRedisValue(serialized)) as StoredMemoryRecord;
      if (this.matchesQuery(record, query)) {
        records.push(this.toMemoryRecord(record));
      }
    }

    return records;
  }

  async delete(selector: MemoryDelete, ctx: MemoryOperationContext): Promise<void> {
    const ids = selector.selector?.id
      ? [selector.selector.id]
      : (await this.redis.sMembers(this.scopeIndexKey(ctx, selector.scope))).map((id) =>
          this.decodeRedisValue(id),
        );
    const indexKey = this.scopeIndexKey(ctx, selector.scope);

    for (const id of ids) {
      const key = this.recordKey(ctx, selector.scope, id);
      const serialized = await this.redis.get(key);
      if (!serialized) {
        await this.redis.sRem(indexKey, id);
        continue;
      }

      const record = JSON.parse(this.decodeRedisValue(serialized)) as StoredMemoryRecord;
      if (!this.matchesDelete(record, selector)) continue;

      await this.redis
        .multi()
        .del(key)
        .sRem(indexKey, id)
        .exec();
    }
  }

  async ttlMs(recordId: string, scope: MemoryScope, ctx: MemoryOperationContext): Promise<number> {
    const ttl = await this.redis.pTTL(this.recordKey(ctx, scope, recordId));
    return typeof ttl === 'number' ? ttl : Number(ttl);
  }

  private decodeRedisValue(value: string | Buffer): string {
    return Buffer.isBuffer(value) ? value.toString('utf8') : value;
  }

  private scopeIndexKey(ctx: MemoryOperationContext, scope: MemoryScope): string {
    return `${this.namespace}:${this.contextKey(ctx)}:${scope}:ids`;
  }

  private recordKey(ctx: MemoryOperationContext, scope: MemoryScope, id: string): string {
    return `${this.namespace}:${this.contextKey(ctx)}:${scope}:${id}`;
  }

  private contextKey(ctx: MemoryOperationContext): string {
    const tenant = ctx.tenant_id ?? 'tenant:none';
    const user = ctx.user_id ?? 'user:none';
    const session = ctx.session_id ?? 'session:none';
    return `${tenant}:${user}:${session}`;
  }

  private matchesQuery(record: StoredMemoryRecord, query: MemoryQuery): boolean {
    if (record.scope !== query.scope) return false;
    const selector = query.selector;
    if (!selector) return true;

    if (selector.tags?.length) {
      const recordTags = record.tags ?? [];
      if (!selector.tags.some((tag) => recordTags.includes(tag))) return false;
    }
    if (selector.prefix && !record.value.startsWith(selector.prefix)) return false;
    if (selector.contains && !record.value.includes(selector.contains)) return false;

    return true;
  }

  private matchesDelete(record: StoredMemoryRecord, selector: MemoryDelete): boolean {
    if (record.scope !== selector.scope) return false;
    if (!selector.selector) return true;

    if (selector.selector.id && record.id !== selector.selector.id) return false;
    if (selector.selector.tags?.length) {
      const recordTags = record.tags ?? [];
      return selector.selector.tags.some((tag) => recordTags.includes(tag));
    }

    return true;
  }

  private toMemoryRecord(record: StoredMemoryRecord): MemoryRecord {
    return {
      id: record.id,
      scope: record.scope,
      classification: record.classification,
      value: record.value,
      ...(record.ttlMs !== undefined ? { ttlMs: record.ttlMs } : {}),
      ...(record.tags !== undefined ? { tags: record.tags } : {}),
      ...(record.source !== undefined ? { source: record.source } : {}),
    };
  }
}

const memoryPolicy: TealMemoryPolicy = {
  enabled: true,
  write: {
    allowed_scopes: ['SESSION', 'USER'],
    deny_if: {
      secrets: true,
      pii: true,
    },
  },
  read: {
    allowed_scopes: ['SESSION'],
    enforce_classification: true,
    max_results: 10,
  },
  retention: {
    ttl_required_for: ['CONFIDENTIAL', 'RESTRICTED'],
    max_ttl_ms: 60_000,
  },
};

async function runExample(): Promise<void> {
  const redis = createClient({
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  });

  redis.on('error', (error) => {
    console.error('Redis client error:', error.message);
  });

  await redis.connect();

  const adapter = new RedisMemoryAdapter(redis);
  const memory = new TealMemory({ adapter });
  const ctx: MemoryOperationContext = {
    correlation_id: 'redis-memory-demo',
    tenant_id: 'tenant-acme',
    user_id: 'user-42',
    session_id: 'session-123',
  };

  console.log('\n--- Write governance: secret scanning happens before Redis writes ---');
  const secretWrite = await memory.write(
    {
      scope: 'SESSION',
      classification: 'CONFIDENTIAL',
      ttlMs: 30_000,
      value: 'api_key=sk_live_this_should_not_be_stored',
      tags: ['support-case'],
      source: 'MODEL',
    },
    ctx,
    memoryPolicy,
  );
  console.log(secretWrite.action, secretWrite.reason_codes);

  console.log('\n--- TTL enforcement: accepted records use Redis PX expiry ---');
  const cleanWrite = await memory.write(
    {
      scope: 'SESSION',
      classification: 'CONFIDENTIAL',
      ttlMs: 30_000,
      value: 'Customer prefers email updates about ticket 123.',
      tags: ['support-case'],
      source: 'USER',
    },
    ctx,
    memoryPolicy,
  );
  console.log(cleanWrite.action, cleanWrite.reason_codes);

  const records = await adapter.get({ scope: 'SESSION', maxResults: 1 }, ctx);
  const ttl = records[0]?.id
    ? await adapter.ttlMs(records[0].id, records[0].scope, ctx)
    : -2;
  console.log('Redis TTL remaining (ms):', ttl);

  console.log('\n--- Read governance: allowed SESSION scope returns Redis records ---');
  const allowedRead = await memory.read(
    { scope: 'SESSION', selector: { tags: ['support-case'] } },
    ctx,
    memoryPolicy,
  );
  console.log(allowedRead.decision.action, allowedRead.decision.reason_codes);
  console.log('Records returned:', allowedRead.records.length);

  console.log('\n--- Read governance: disallowed GLOBAL scope is denied before Redis reads ---');
  const deniedRead = await memory.read(
    { scope: 'GLOBAL' },
    ctx,
    memoryPolicy,
  );
  console.log(deniedRead.decision.action, deniedRead.decision.reason_codes);

  await redis.quit();
}

runExample().catch((error) => {
  console.error('Redis memory adapter example failed:', error);
  process.exit(1);
});
