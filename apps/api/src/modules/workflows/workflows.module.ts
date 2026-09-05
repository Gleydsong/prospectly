import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WorkflowsService } from './application/workflows.service';
import { WorkflowsController } from './presentation/workflows.controller';

@Module({
  imports: [AuditModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
