import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly outbox?: OutboxService,
  ) {}

  async list(organizationId: string, query: QueryTasksDto) {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
      NOT: {
        lead: {
          is: { deletedAt: { not: null } },
        },
      },
    };

    const [total, rows] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: this.taskInclude,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(
      rows.map((task) => this.serialize(task)),
      total,
      query.page,
      query.pageSize,
    );
  }

  async create(organizationId: string, userId: string, dto: CreateTaskDto) {
    if (dto.leadId) {
      await this.assertLead(organizationId, dto.leadId);
    }
    if (dto.assigneeId) {
      await this.assertMember(organizationId, dto.assigneeId);
    }
    return this.serialize(
      await this.prisma.task.create({
        data: {
          organizationId,
          createdById: userId,
          title: dto.title.trim(),
          description: dto.description,
          dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
          priority: dto.priority ?? 'MEDIUM',
          assigneeId: dto.assigneeId ?? userId,
          leadId: dto.leadId,
        },
        include: this.taskInclude,
      }),
    );
  }

  async update(organizationId: string, id: string, userId: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (dto.assigneeId) {
      await this.assertMember(organizationId, dto.assigneeId);
    }

    const completing = dto.status === 'DONE' && task.status !== 'DONE';
    const data = {
      title: dto.title?.trim(),
      description: dto.description,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
      priority: dto.priority,
      status: dto.status,
      ...(dto.status === 'DONE' ? { completedAt: new Date() } : {}),
      ...(dto.status && dto.status !== 'DONE' ? { completedAt: null } : {}),
      assigneeId: dto.assigneeId,
    };

    if (!completing) {
      return this.serialize(
        await this.prisma.task.update({
          where: { id },
          data,
          include: this.taskInclude,
        }),
      );
    }

    const [updated, event] = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.task.update({
        where: { id },
        data,
        include: this.taskInclude,
      });
      const outboxEvent = this.outbox
        ? await this.outbox.appendTaskCompleted(tx, {
            organizationId,
            taskId: task.id,
            actorId: userId,
            payload: {
              taskId: task.id,
              leadId: task.leadId,
              campaignId: task.campaignId,
              campaignStageId: task.campaignStageId,
            },
          })
        : null;
      return [saved, outboxEvent] as const;
    });

    if (event && this.outbox) {
      try {
        await this.outbox.dispatch(event);
      } catch {
        // Redis down: reconciler republishes from the persisted PENDING row.
      }
    }

    return this.serialize(updated);
  }

  async remove(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.prisma.task.delete({ where: { id } });
  }

  private readonly taskInclude = {
    assignee: { select: { id: true, name: true } },
    lead: { select: { id: true, companyName: true, deletedAt: true } },
  } as const;

  private serialize<
    T extends {
      lead: { id: string; companyName: string; deletedAt: Date | null } | null;
    },
  >(task: T) {
    const lead = task.lead;
    return {
      ...task,
      lead: lead && lead.deletedAt == null ? { id: lead.id, companyName: lead.companyName } : null,
    };
  }

  private async assertLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) {
      throw new BadRequestException('Lead not found in this organization');
    }
  }

  private async assertMember(organizationId: string, userId: string) {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) {
      throw new BadRequestException('Assignee must be a member of the organization');
    }
  }
}
