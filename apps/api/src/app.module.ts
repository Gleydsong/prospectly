import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';

import { configuration } from './config/configuration';
import { validateEnv } from './config/validation';
import { parseRedisConnection } from './config/redis';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantContextInterceptor } from './common/prisma/tenant-context.interceptor';
import { HealthModule } from './common/health/health.module';
import { MailModule } from './common/mail/mail.module';
import { RateLimitGuard } from './common/throttler/rate-limit.guard';
import { RedisThrottlerStorage } from './common/throttler/redis-throttler.storage';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { EmailVerifiedGuard } from './common/guards/email-verified.guard';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { PipelinesModule } from './modules/pipelines/pipelines.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ProspectingModule } from './modules/prospecting/prospecting.module';
import { ImportsModule } from './modules/imports/imports.module';
import { GeoModule } from './modules/geo/geo.module';
import { BillingModule } from './modules/billing/billing.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { WebsiteAnalysisModule } from './modules/website-analysis/website-analysis.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { OpsModule } from './modules/ops/ops.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AgentsModule } from './modules/agents/agents.module';
import { OpportunityFinderModule } from './modules/opportunity-finder/opportunity-finder.module';
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
              'res.headers["set-cookie"]',
              'req.body.password',
              'req.body.newPassword',
              'req.body.currentPassword',
              'req.body.temporaryPassword',
              'req.body.refreshToken',
              'req.body.token',
              'req.query.token',
            ],
            censor: '[REDACTED]',
          },
          genReqId: (req, res) => {
            const header = req.headers['x-correlation-id'];
            const id =
              typeof header === 'string' && header.length > 0 ? header : crypto.randomUUID();
            res.setHeader('x-correlation-id', id);
            return id;
          },
          transport:
            config.get<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [{ ttl: 60_000, limit: 120 }],
        storage: new RedisThrottlerStorage(config),
      }),
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: parseRedisConnection(config.getOrThrow<string>('redisUrl')),
      }),
    }),
    PrismaModule,
    HealthModule,
    OpsModule,
    MailModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrganizationsModule,
    LeadsModule,
    ActivitiesModule,
    TasksModule,
    PipelinesModule,
    DashboardModule,
    ProspectingModule,
    ImportsModule,
    GeoModule,
    BillingModule,
    ScoringModule,
    WebsiteAnalysisModule,
    WaitlistModule,
    CampaignsModule,
    IntegrationsModule,
    AgentsModule,
    OpportunityFinderModule,
    // Production Render currently has no dedicated worker service. Process
    // BullMQ jobs in the API so searches/checkout side-effects do not stall.
    WorkersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: EmailVerifiedGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
