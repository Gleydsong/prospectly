import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';

import { extendPrismaClient } from './tenant-prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService) {
    const appUrl = config.get<string>('databaseAppUrl')?.trim();
    const ownerUrl = config.get<string>('databaseUrl')?.trim();
    const url = (appUrl && appUrl.length > 0 ? appUrl : undefined) ?? ownerUrl ?? process.env.DATABASE_URL;
    super(url ? { datasources: { db: { url } } } : undefined);
    const extended = extendPrismaClient(this);
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
