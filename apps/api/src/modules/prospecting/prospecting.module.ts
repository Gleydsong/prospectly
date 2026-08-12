import { BullModule, getQueueToken } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { LeadsModule } from '../leads/leads.module';
import { BillingModule } from '../billing/billing.module';
import {
  GOOGLE_PLACES_SEARCH_PROVIDER,
  InMemorySearchProviderRegistry,
  OPENSTREETMAP_SEARCH_PROVIDER,
  SEARCH_PROVIDER_REGISTRY,
  type SearchProvider,
} from './domain/search-provider';
import { GooglePlacesProvider } from './infrastructure/google-places.provider';
import { OpenStreetMapProvider } from './infrastructure/openstreetmap.provider';
import {
  RedisNominatimRateLimiter,
  type RedisEvalClient,
} from './infrastructure/nominatim-rate-limiter';
import { PROSPECTING_QUEUE } from './prospecting.constants';
import { ProspectingController } from './prospecting.controller';
import { ProspectingDispatchReconciler } from './prospecting-dispatch.reconciler';
import { ProspectingService } from './prospecting.service';

@Module({
  imports: [BullModule.registerQueue({ name: PROSPECTING_QUEUE }), LeadsModule, BillingModule],
  controllers: [ProspectingController],
  providers: [
    ProspectingService,
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
    {
      provide: GOOGLE_PLACES_SEARCH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService): SearchProvider | null => {
        const apiKey = config.get<string>('googlePlaces.apiKey')?.trim() ?? '';
        if (!apiKey) return null;
        return new GooglePlacesProvider({
          apiKey,
          baseUrl: config.get<string>('googlePlaces.baseUrl'),
          timeoutMs: config.getOrThrow<number>('googlePlaces.timeoutMs'),
          resultLimit: config.getOrThrow<number>('googlePlaces.resultLimit'),
        });
      },
    },
    {
      provide: SEARCH_PROVIDER_REGISTRY,
      inject: [OPENSTREETMAP_SEARCH_PROVIDER, GOOGLE_PLACES_SEARCH_PROVIDER],
      useFactory: (osm: SearchProvider, google: SearchProvider | null) =>
        new InMemorySearchProviderRegistry([
          { id: 'OPENSTREETMAP', label: 'OpenStreetMap', provider: osm },
          { id: 'GOOGLE_PLACES', label: 'Google Places', provider: google },
        ]),
    },
  ],
  exports: [ProspectingService, SEARCH_PROVIDER_REGISTRY],
})
export class ProspectingModule {}
