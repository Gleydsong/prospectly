import { Injectable, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import { MetricsService } from '../../modules/ops/metrics.service';
import {
  prismaConnectionLimit,
  prismaProcessRole,
  PRISMA_POOL_TIMEOUT_SECONDS,
  withPrismaPoolParams,
} from './prisma-pool';
import { instrumentPrismaTransaction } from './prisma-transaction-metrics';
import { extendPrismaClient } from './tenant-prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService, @Optional() metrics?: MetricsService) {
    const appUrl = config.get<string>('databaseAppUrl')?.trim();
    const ownerUrl = config.get<string>('databaseUrl')?.trim();
    const url = (appUrl && appUrl.length > 0 ? appUrl : undefined) ?? ownerUrl ?? process.env.DATABASE_URL;
    const pooled = url
      ? withPrismaPoolParams(url, {
          connectionLimit: prismaConnectionLimit(prismaProcessRole()),
          poolTimeoutSeconds: PRISMA_POOL_TIMEOUT_SECONDS,
        })
      : undefined;
    super(pooled ? { datasources: { db: { url: pooled } } } : undefined);
    const extended = extendPrismaClient(this);
    instrumentPrismaTransaction(extended, () => metrics?.recordDbTransactionFailure());
    Object.defineProperty(extended, 'onModuleInit', {
      value: async () => {
        await extended.$connect();
      },
    });
    Object.defineProperty(extended, 'onModuleDestroy', {
      value: async () => {
        await extended.$disconnect();
      },
    });
    return extended as unknown as this;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
