import { Injectable, NotFoundException } from '@nestjs/common';

import { paginate } from '../../common/dto/pagination.dto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateActivityDto } from './dto/create-activity.dto';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async listForLead(organizationId: string, leadId: string, page = 1, pageSize = 50) {
    await this.assertLead(organizationId, leadId);
    const where = { organizationId, leadId };
    const [total, activities] = await this.prisma.$transaction([
      this.prisma.leadActivity.count({ where }),
      this.prisma.leadActivity.findMany({
        where,
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return paginate(activities, total, page, pageSize);
  }

  async createForLead(
    organizationId: string,
    leadId: string,
    userId: string,
    dto: CreateActivityDto,
  ) {
    await this.assertLead(organizationId, leadId);

    const [activity] = await this.prisma.$transaction([
      this.prisma.leadActivity.create({
        data: {
          organizationId,
          leadId,
          userId,
          type: dto.type,
          description: dto.description,
          outcome: dto.outcome,
          nextAction: dto.nextAction,
          followUpAt: dto.followUpAt ? new Date(dto.followUpAt) : undefined,
        },
        include: { user: { select: { id: true, name: true } } },
      }),
      this.prisma.lead.update({
        where: { id: leadId },
        data: {
          lastContactAt: new Date(),
          ...(dto.followUpAt ? { nextContactAt: new Date(dto.followUpAt) } : {}),
        },
      }),
    ]);

    return activity;
  }

  async listRecent(organizationId: string, limit = 20) {
    return this.prisma.leadActivity.findMany({
      where: { organizationId },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, companyName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private async assertLead(organizationId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) {
      throw new NotFoundException('Lead not found');
    }
  }
}
