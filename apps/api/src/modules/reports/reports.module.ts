import { Module } from '@nestjs/common';

import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { SavedReportsController } from './saved-reports.controller';
import { SavedReportsService } from './saved-reports.service';

@Module({
  controllers: [ReportsController, SavedReportsController],
  providers: [ReportsService, SavedReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
