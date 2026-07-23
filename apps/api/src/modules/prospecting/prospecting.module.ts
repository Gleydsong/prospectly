import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { LeadsModule } from '../leads/leads.module';
import { OPENSTREETMAP_SEARCH_PROVIDER } from './domain/search-provider';
import { OpenStreetMapProvider } from './infrastructure/openstreetmap.provider';
import {
  RedisNominatimRateLimiter,
  type RedisEvalClient,
} from './infrastructure/nominatim-rate-limiter';
import { PROSPECTING_QUEUE } from './prospecting.constants';
import { ProspectingController } from './prospecting.controller';
import { ProspectingDispatchReconciler } from './prospecting-dispatch.reconciler';
import { ProspectingProcessor } from './prospecting.processor';
import { ProspectingService } from './prospecting.service';

@Module({
  imports: [BullModule.registerQueue({ name: PROSPECTING_QUEUE }), LeadsModule],
  controllers: [ProspectingController],
  providers: [
    ProspectingService,
    ProspectingProcessor,
    {
      provide: ProspectingDispatchReconciler,
      inject: [ProspectingService],
      useFactory: (service: ProspectingService) => new ProspectingDispatchReconciler(service),
    },
    {
      provide: OPENSTREETMAP_SEARCH_PROVIDER,
      inject: [ConfigService, getQueueToken(PROSPECTING_QUEUE)],
      useFactory: (config: ConfigService, queue: Queue) =>
        new OpenStreetMapProvider({
          nominatimUrl: config.getOrThrow<string>('openStreetMap.nominatimUrl'),
          overpassUrl: config.getOrThrow<string>('openStreetMap.overpassUrl'),
          userAgent: config.getOrThrow<string>('openStreetMap.userAgent'),
          timeoutMs: config.getOrThrow<number>('openStreetMap.timeoutMs'),
          resultLimit: config.getOrThrow<number>('openStreetMap.resultLimit'),
          rateLimiter: new RedisNominatimRateLimiter(
            queue.client as unknown as Promise<RedisEvalClient>,
          ),
        }),
    },
  ],
})
export class ProspectingModule {}
