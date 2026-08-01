import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { paginate, PaginationQueryDto } from '../../../common/dto/pagination.dto';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  SAFE_TEMPLATE_VARIABLES,
  renderTemplate,
  validateTemplateVariables,
  type TemplateVariableValues,
} from '../domain/template-variables';
import { CreateTemplateDto } from '../presentation/dto/create-template.dto';
import { PreviewTemplateDto } from '../presentation/dto/preview-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  listAllowedVariables() {
    return [...SAFE_TEMPLATE_VARIABLES];
  }

  async list(organizationId: string, query: PaginationQueryDto) {
    const where: Prisma.MessageTemplateWhereInput = { organizationId };
    const [total, data] = await this.prisma.$transaction([
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
    return this.prisma.messageTemplate.create({
      data: {
        organizationId,
        createdById: userId,
        name: dto.name.trim(),
        category: dto.category.trim().toUpperCase(),
        subject: dto.subject?.trim(),
        body: dto.body.trim(),
      },
    });
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
