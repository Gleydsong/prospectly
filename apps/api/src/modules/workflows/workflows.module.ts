import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { WorkflowExecutorService } from './application/workflow-executor.service';
import { WorkflowsService } from './application/workflows.service';
import { WorkflowsController } from './presentation/workflows.controller';

@Module({
  imports: [AuditModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService, WorkflowExecutorService],
  exports: [WorkflowsService, WorkflowExecutorService],
})
export class WorkflowsModule {}
