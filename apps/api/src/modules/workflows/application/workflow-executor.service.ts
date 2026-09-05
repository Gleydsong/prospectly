import { Injectable, Logger } from '@nestjs/common';
import { OutboxEventStatus, Prisma, WorkflowStatus, WorkflowStepRunOutcome } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { compileLeadFilter } from '../../leads/domain/lead-filter-ast';
import { LEAD_CREATED_TYPE } from '../../outbox/outbox.constants';
import {
  parseWorkflowDefinition,
  WORKFLOW_STEP_ADD_TAG,
  type WorkflowDefinition,
} from '../domain/workflow-definition';

type ExecuteStepInput = {
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  version: number;
  eventId: string;
  leadId: string;
  stepIndex: number;
  definition: WorkflowDefinition;
};

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  constructor(private readonly prisma: PrismaService) {}

  async handleOutboxEvent(eventId: string): Promise<void> {
    const event = await this.prisma.outboxEvent.findUnique({ where: { id: eventId } });
    if (!event || event.status !== OutboxEventStatus.PROCESSED) {
      return;
    }
    if (event.type !== LEAD_CREATED_TYPE) {
      return;
    }
    const payload = event.payload;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return;
    }
    const leadId = (payload as Record<string, unknown>).leadId;
    if (typeof leadId !== 'string' || !leadId) {
      return;
    }
    await this.executeLeadCreated({
      organizationId: event.organizationId,
      leadId,
      eventId: event.id,
    });
  }

  async executeLeadCreated(input: {
    organizationId: string;
    leadId: string;
    eventId: string;
  }): Promise<void> {
    const workflows = await this.prisma.workflow.findMany({
      where: {
        organizationId: input.organizationId,
        status: WorkflowStatus.ACTIVE,
        archivedAt: null,
        publishedVersionId: { not: null },
      },
    });
    for (const workflow of workflows) {
      if (!workflow.publishedVersionId) continue;
      const version = await this.prisma.workflowVersion.findFirst({
        where: {
          id: workflow.publishedVersionId,
          organizationId: input.organizationId,
          workflowId: workflow.id,
        },
      });
      if (!version) continue;
      let definition: WorkflowDefinition;
      try {
        definition = parseWorkflowDefinition(version.definition);
      } catch {
        this.logger.warn({
          message: 'Skipping Fluxo with invalid published definition',
          workflowId: workflow.id,
          workflowVersionId: version.id,
          eventId: input.eventId,
        });
        continue;
      }
      if (definition.trigger.type !== LEAD_CREATED_TYPE) continue;
      for (let stepIndex = 0; stepIndex < definition.steps.length; stepIndex += 1) {
        await this.executeStep({
          organizationId: input.organizationId,
          workflowId: workflow.id,
          workflowVersionId: version.id,
          version: version.version,
          eventId: input.eventId,
          leadId: input.leadId,
          stepIndex,
          definition,
        });
      }
    }
  }

  private async executeStep(input: ExecuteStepInput): Promise<void> {
    const existing = await this.prisma.workflowStepRun.findUnique({
      where: {
        workflowVersionId_eventId_stepIndex: {
          workflowVersionId: input.workflowVersionId,
          eventId: input.eventId,
          stepIndex: input.stepIndex,
        },
      },
    });
    if (existing) {
      this.logOutcome(input, existing.outcome);
      return;
    }

    const lead = await this.prisma.lead.findFirst({
      where: {
        id: input.leadId,
        organizationId: input.organizationId,
        deletedAt: null,
      },
      select: { id: true, doNotContact: true },
    });
    if (!lead || lead.doNotContact) {
      await this.recordRun(input, WorkflowStepRunOutcome.SKIPPED);
      return;
    }
    if (input.definition.filter) {
      const matched = await this.prisma.lead.findFirst({
        where: {
          AND: [
            {
              id: input.leadId,
              organizationId: input.organizationId,
              deletedAt: null,
            },
            compileLeadFilter(input.definition.filter),
          ],
        },
        select: { id: true },
      });
      if (!matched) {
        await this.recordRun(input, WorkflowStepRunOutcome.SKIPPED);
        return;
      }
    }

    const step = input.definition.steps[input.stepIndex];
    if (!step || step.type !== WORKFLOW_STEP_ADD_TAG) {
      await this.recordRun(input, WorkflowStepRunOutcome.SKIPPED);
      return;
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const tag = await tx.tag.upsert({
          where: {
            organizationId_name: {
              organizationId: input.organizationId,
              name: step.tagName,
            },
          },
          create: { organizationId: input.organizationId, name: step.tagName },
          update: {},
        });
        await tx.leadTag.createMany({
          data: [{ leadId: input.leadId, tagId: tag.id }],
          skipDuplicates: true,
        });
        await tx.workflowStepRun.create({
          data: {
            organizationId: input.organizationId,
            workflowId: input.workflowId,
            workflowVersionId: input.workflowVersionId,
            eventId: input.eventId,
            leadId: input.leadId,
            stepIndex: input.stepIndex,
            outcome: WorkflowStepRunOutcome.APPLIED,
          },
        });
      });
      this.logOutcome(input, WorkflowStepRunOutcome.APPLIED);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        this.logOutcome(input, WorkflowStepRunOutcome.APPLIED);
        return;
      }
      throw error;
    }
  }

  private async recordRun(input: ExecuteStepInput, outcome: WorkflowStepRunOutcome): Promise<void> {
    try {
      await this.prisma.workflowStepRun.create({
        data: {
          organizationId: input.organizationId,
          workflowId: input.workflowId,
          workflowVersionId: input.workflowVersionId,
          eventId: input.eventId,
          leadId: input.leadId,
          stepIndex: input.stepIndex,
          outcome,
        },
      });
    } catch (error) {
      if (!this.isUniqueViolation(error)) {
        throw error;
      }
    }
    this.logOutcome(input, outcome);
  }

  private logOutcome(input: ExecuteStepInput, outcome: WorkflowStepRunOutcome): void {
    this.logger.log({
      message: 'Workflow step finished',
      workflowId: input.workflowId,
      workflowVersionId: input.workflowVersionId,
      version: input.version,
      eventId: input.eventId,
      leadId: input.leadId,
      stepIndex: input.stepIndex,
      outcome,
    });
  }

  private isUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
