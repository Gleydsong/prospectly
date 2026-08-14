import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(organizationId: string, query: QueryTasksDto) {
    const where: Prisma.TaskWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
      ...(query.leadId ? { leadId: query.leadId } : {}),
    };

    const [total, tasks] = await Promise.all([
      this.prisma.task.count({ where }),
      this.prisma.task.findMany({
        where,
        include: {
          assignee: { select: { id: true, name: true } },
          lead: { select: { id: true, companyName: true } },
        },
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(tasks, total, query.page, query.pageSize);
  }

  async create(organizationId: string, userId: string, dto: CreateTaskDto) {
    if (dto.leadId) {
      await this.assertLead(organizationId, dto.leadId);
    }
    if (dto.assigneeId) {
      await this.assertMember(organizationId, dto.assigneeId);
    }
    return this.prisma.task.create({
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
      include: {
        assignee: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true } },
      },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateTaskDto) {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    if (dto.assigneeId) {
      await this.assertMember(organizationId, dto.assigneeId);
    }
    return this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title?.trim(),
        description: dto.description,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : undefined,
        priority: dto.priority,
        status: dto.status,
        ...(dto.status === 'DONE' ? { completedAt: new Date() } : {}),
        ...(dto.status && dto.status !== 'DONE' ? { completedAt: null } : {}),
        assigneeId: dto.assigneeId,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true } },
      },
    });
  }

  async remove(organizationId: string, id: string) {
    const task = await this.prisma.task.findFirst({ where: { id, organizationId } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    await this.prisma.task.delete({ where: { id } });
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
