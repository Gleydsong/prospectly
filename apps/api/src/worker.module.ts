import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';

import { configuration } from './config/configuration';
import { validateEnv } from './config/validation';
import { parseRedisConnection } from './config/redis';
import { PrismaModule } from './common/prisma/prisma.module';
import { WorkersModule } from './modules/workers/workers.module';

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
            paths: [
              'req.headers.authorization',
              'req.headers.cookie',
              'req.body.password',
              'req.body.refreshToken',
              'req.body.token',
            ],
            censor: '[REDACTED]',
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
    WorkersModule,
  ],
})
export class WorkerModule {}
