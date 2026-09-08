import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { CalendarHttpAdapter } from './calendar.adapter';
import { CALENDAR_PORT } from './calendar.port';
import { CommunicationsController } from './communications.controller';
import { GMAIL_SYNC_QUEUE } from './communications.constants';
import { CommunicationsService } from './communications.service';
import { GmailHttpAdapter } from './gmail.adapter';
import { GMAIL_PORT } from './gmail.port';
import { GmailIngestService } from './gmail-ingest.service';

@Module({
  imports: [BullModule.registerQueue({ name: GMAIL_SYNC_QUEUE })],
  controllers: [CommunicationsController],
  providers: [
    CommunicationsService,
    GmailIngestService,
    {
      provide: GMAIL_PORT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new GmailHttpAdapter(config),
    },
    {
      provide: CALENDAR_PORT,
      useClass: CalendarHttpAdapter,
    },
  ],
  exports: [CommunicationsService, GmailIngestService, BullModule],
})
export class CommunicationsModule {}
