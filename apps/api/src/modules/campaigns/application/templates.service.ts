import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { paginate, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  SAFE_TEMPLATE_VARIABLES,
  renderTemplate,
  validateTemplateVariables,
  type TemplateVariableValues,
} from '../domain/template-variables';
import { CreateTemplateDto } from '../presentation/dto/create-template.dto';
import { PreviewTemplateDto } from '../presentation/dto/preview-template.dto';
import { UpdateTemplateDto } from '../presentation/dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listAllowedVariables() {
    return [...SAFE_TEMPLATE_VARIABLES];
  }

  async list(organizationId: string, query: PaginationQueryDto) {
    const where: Prisma.MessageTemplateWhereInput = { organizationId };
    const [total, data] = await Promise.all([
      this.prisma.messageTemplate.count({ where }),
      this.prisma.messageTemplate.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return paginate(data, total, query.page, query.pageSize);
  }

  async get(organizationId: string, id: string) {
    const template = await this.prisma.messageTemplate.findFirst({
      where: { id, organizationId },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    return template;
  }

  async create(organizationId: string, userId: string, dto: CreateTemplateDto) {
    this.assertSafeContent(dto.subject, dto.body);
    const template = await this.prisma.messageTemplate.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name.trim(),
        category: dto.category.trim().toUpperCase(),
        subject: dto.subject?.trim(),
        body: dto.body.trim(),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MESSAGE_TEMPLATE_CREATED,
      entity: 'MessageTemplate',
      entityId: template.id,
      metadata: { name: template.name, category: template.category, autoSend: false },
    });

    return template;
  }

  async update(organizationId: string, userId: string, id: string, dto: UpdateTemplateDto) {
    const existing = await this.get(organizationId, id);
    const subject = dto.subject === undefined ? existing.subject ?? undefined : dto.subject ?? undefined;
    const body = dto.body ?? existing.body;
    this.assertSafeContent(subject, body);

    const template = await this.prisma.messageTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim().toUpperCase() } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject?.trim() || null } : {}),
        ...(dto.body !== undefined ? { body: dto.body.trim() } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: AUDIT_ACTIONS.MESSAGE_TEMPLATE_UPDATED,
      entity: 'MessageTemplate',
      entityId: template.id,
      metadata: { name: template.name, category: template.category, autoSend: false },
    });

    return template;
  }

  preview(dto: PreviewTemplateDto) {
    this.assertSafeContent(dto.subject, dto.body);
    const values = this.pickSafeValues(dto.values);
    const subject = dto.subject
      ? renderTemplate(dto.subject, values)
      : { rendered: undefined, missing: [] as string[], unknown: [] as string[] };
    const body = renderTemplate(dto.body, values);
    return {
      subject: subject.rendered,
      body: body.rendered,
      missing: [...new Set([...subject.missing, ...body.missing])],
      unknown: [...new Set([...subject.unknown, ...body.unknown])],
      allowedVariables: this.listAllowedVariables(),
      autoSend: false,
      messageSent: false,
      note: 'Assisted preview only — no message is sent.',
    };
  }

  assertSafeContent(subject: string | undefined, body: string) {
    const subjectCheck = subject ? validateTemplateVariables(subject) : { valid: true, unknown: [] };
    const bodyCheck = validateTemplateVariables(body);
    const unknown = [...new Set([...subjectCheck.unknown, ...bodyCheck.unknown])];
    if (unknown.length > 0) {
      throw new BadRequestException({
        message: 'Template contains unsupported variables',
        unknown,
        allowed: this.listAllowedVariables(),
      });
    }
  }

  private pickSafeValues(values?: Record<string, string>): TemplateVariableValues {
    if (!values) {
      return {};
    }
    const picked: TemplateVariableValues = {};
    for (const key of SAFE_TEMPLATE_VARIABLES) {
      if (key in values) {
        picked[key] = values[key];
      }
    }
    return picked;
  }
}
