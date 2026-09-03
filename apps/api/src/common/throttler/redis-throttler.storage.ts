import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

import { parseRedisConnection } from '../../config/redis';
import { MetricsService } from '../../modules/ops/metrics.service';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

const INCREMENT_SCRIPT = `
local hitKey = KEYS[1]
local blockKey = KEYS[2]
local ttl = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local blockMs = tonumber(ARGV[3])

local blockTtl = redis.call('PTTL', blockKey)
if blockTtl > 0 then
  return {limit + 1, 0, 1, blockTtl}
end

local hits = redis.call('INCR', hitKey)
if hits == 1 or tonumber(redis.call('PTTL', hitKey)) < 0 then
  redis.call('PEXPIRE', hitKey, ttl)
end
local hitTtl = tonumber(redis.call('PTTL', hitKey))
if hitTtl < 0 then
  hitTtl = ttl
end

if hits > limit then
  redis.call('SET', blockKey, '1', 'PX', blockMs)
  return {hits, hitTtl, 1, blockMs}
end

return {hits, hitTtl, 0, 0}
`;

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly logger = new Logger(RedisThrottlerStorage.name);
  private readonly redis: Redis;
  private redisDown = false;

  constructor(
    config: ConfigService,
    @Optional() private readonly metrics?: MetricsService,
  ) {
    const parsed = parseRedisConnection(config.getOrThrow<string>('redisUrl'));
    this.redis = new Redis({
      host: parsed.host,
      port: parsed.port,
      db: parsed.db,
      username: parsed.username,
      password: parsed.password,
      ...(parsed.tls ? { tls: parsed.tls } : {}),
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      connectTimeout: 1_000,
      lazyConnect: false,
    });
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const hitKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `throttle:block:${throttlerName}:${key}`;
    const blockMs = blockDuration > 0 ? blockDuration : ttl;

    try {
      const raw = (await this.redis.eval(
        INCREMENT_SCRIPT,
        2,
        hitKey,
        blockKey,
        String(ttl),
        String(limit),
        String(blockMs),
      )) as unknown;
      this.markRedisUp();
      return this.toRecord(raw, ttl, blockMs);
    } catch (error) {
      this.markRedisDown(error);
      return {
        totalHits: 1,
        timeToExpire: Math.max(1, Math.ceil(ttl / 1000)),
        isBlocked: false,
        timeToBlockExpire: 0,
      };
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }

  private toRecord(raw: unknown, ttl: number, blockMs: number): ThrottlerStorageRecord {
    const row = Array.isArray(raw) ? raw : [];
    const totalHits = Number(row[0]);
    const hitTtlMs = Number(row[1]);
    const blocked = Number(row[2]) === 1;
    const blockTtlMs = Number(row[3]);
    return {
      totalHits: Number.isFinite(totalHits) ? totalHits : 1,
      timeToExpire: Math.max(1, Math.ceil((Number.isFinite(hitTtlMs) ? hitTtlMs : ttl) / 1000)),
      isBlocked: blocked,
      timeToBlockExpire: blocked
        ? Math.max(1, Math.ceil((Number.isFinite(blockTtlMs) ? blockTtlMs : blockMs) / 1000))
        : 0,
    };
  }

  private markRedisDown(error: unknown): void {
    this.metrics?.recordRedisError();
    if (!this.redisDown) {
      this.redisDown = true;
      this.logger.warn({
        event: 'redis_unavailable',
        message: 'Rate limiter failing open because Redis is unavailable',
        error: error instanceof Error ? error.message.slice(0, 120) : 'redis_error',
      });
    }
  }

  private markRedisUp(): void {
    if (!this.redisDown) return;
    this.redisDown = false;
    this.logger.log({ event: 'redis_recovered', message: 'Rate limiter Redis connection recovered' });
  }
}
