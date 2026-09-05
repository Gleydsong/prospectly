import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { LeadsModule } from '../leads/leads.module';
import { SavedViewsService } from './application/saved-views.service';
import { SavedViewsController } from './presentation/saved-views.controller';

@Module({
  imports: [AuditModule, LeadsModule],
  controllers: [SavedViewsController],
  providers: [SavedViewsService],
  exports: [SavedViewsService],
})
export class SavedViewsModule {}
