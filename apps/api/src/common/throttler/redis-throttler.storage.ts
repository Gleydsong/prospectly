import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ThrottlerStorage } from '@nestjs/throttler';
import Redis from 'ioredis';

import { parseRedisConnection } from '../../config/redis';

interface ThrottlerStorageRecord {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
}

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage, OnModuleDestroy {
  private readonly redis: Redis;

  constructor(config: ConfigService) {
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

    const blockTtlMs = await this.redis.pttl(blockKey);
    if (blockTtlMs > 0) {
      return {
        totalHits: limit + 1,
        timeToExpire: 0,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockTtlMs / 1000),
      };
    }

    const hits = await this.redis.incr(hitKey);
    if (hits === 1) {
      await this.redis.pexpire(hitKey, ttl);
    }

    const hitTtlMs = await this.redis.pttl(hitKey);
    const timeToExpire = Math.max(1, Math.ceil(hitTtlMs / 1000));

    if (hits > limit) {
      const blockMs = blockDuration > 0 ? blockDuration : ttl;
      await this.redis.set(blockKey, '1', 'PX', blockMs);
      return {
        totalHits: hits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: Math.ceil(blockMs / 1000),
      };
    }

    return {
      totalHits: hits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => undefined);
  }
}
