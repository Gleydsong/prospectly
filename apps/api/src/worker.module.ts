import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { configuration } from './config/configuration';
import { validateEnv } from './config/validation';
import { parseRedisConnection } from './config/redis';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './modules/audit/audit.module';
import { OpsModule } from './modules/ops/ops.module';
import { WorkersModule } from './modules/workers/workers.module';
import { PINO_REDACT_CENSOR, PINO_REDACT_PATHS } from './common/logging/pino-redact-paths';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.get<string>('LOG_LEVEL') ?? 'info',
          redact: {
            paths: [...PINO_REDACT_PATHS],
            censor: PINO_REDACT_CENSOR,
          },
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisConnection(config.getOrThrow<string>('redisUrl')),
      }),
    }),
    PrismaModule,
    AuditModule,
    OpsModule,
    WorkersModule,
  ],
})
export class WorkerModule {}
