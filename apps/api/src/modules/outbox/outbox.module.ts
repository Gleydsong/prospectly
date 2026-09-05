import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { IntegrationsModule } from '../integrations/integrations.module';
import { OUTBOX_QUEUE } from './outbox.constants';
import { OutboxService } from './outbox.service';

@Module({
  imports: [BullModule.registerQueue({ name: OUTBOX_QUEUE }), IntegrationsModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
