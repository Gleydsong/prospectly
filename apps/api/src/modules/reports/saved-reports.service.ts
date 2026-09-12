import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateSavedReportDto } from './dto/create-saved-report.dto';
import type { QuerySavedReportLeadsDto } from './dto/query-saved-report-leads.dto';
import { ReportsService } from './reports.service';
import {
  InvalidSavedReportDefinitionError,
  normalizeSavedReportName,
  parseSavedReportDefinition,
  type SavedReportDefinition,
} from './saved-report-definition';

const WRITER_ROLES: Role[] = ['OWNER', 'ADMIN', 'SALES', 'MEMBER'];

type Actor = { id: string; role: Role };

type SavedReportRow = {
  id: string;
  organizationId: string;
  ownerId: string;
  name: string;
  definition: Prisma.JsonValue;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class SavedReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  async create(organizationId: string, actor: Actor, dto: CreateSavedReportDto) {
    this.assertCanWrite(actor);
    const name = dto.name.trim();
    const definition = this.parseDefinition(dto.definition);
    try {
      const created = await this.prisma.savedReport.create({
        data: {
          organizationId,
          ownerId: actor.id,
          name,
          nameNormalized: normalizeSavedReportName(name),
          definition: definition as Prisma.InputJsonValue,
        },
      });
      return this.serialize(created, actor);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'SAVED_REPORT_NAME_TAKEN',
          message: 'Já existe um Relatório salvo com este nome na organização.',
        });
      }
      throw error;
    }
  }

  async list(organizationId: string, actor: Actor) {
    const rows = await this.prisma.savedReport.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.serialize(row, actor));
  }

  async get(organizationId: string, actor: Actor, id: string) {
    return this.serialize(await this.requireActive(organizationId, id), actor);
  }

  async archive(organizationId: string, actor: Actor, id: string) {
    const report = await this.requireActive(organizationId, id);
    this.assertCanMutate(report, actor);
    const archived = await this.prisma.savedReport.update({
      where: { id: report.id },
      data: { archivedAt: new Date() },
    });
    return this.serialize(archived, actor);
  }

  async funnelConversion(organizationId: string, actor: Actor, id: string) {
    const report = await this.requireActive(organizationId, id);
    return this.reports.funnelConversion(organizationId, this.parseDefinition(report.definition));
  }

  async funnelConversionLeads(
    organizationId: string,
    actor: Actor,
    id: string,
    query: QuerySavedReportLeadsDto,
  ) {
    const report = await this.requireActive(organizationId, id);
    const definition = this.parseDefinition(report.definition);
    return this.reports.funnelConversionLeads(organizationId, {
      ...definition,
      bucket: query.bucket,
    });
  }

  private async requireActive(organizationId: string, id: string): Promise<SavedReportRow> {
    const report = await this.prisma.savedReport.findFirst({
      where: { id, organizationId, archivedAt: null },
    });
    if (!report) throw new NotFoundException('Saved report not found');
    return report;
  }

  private parseDefinition(raw: unknown): SavedReportDefinition {
    try {
      return parseSavedReportDefinition(raw);
    } catch (error) {
      if (error instanceof InvalidSavedReportDefinitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private assertCanWrite(actor: Actor) {
    if (!WRITER_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
  }

  private assertCanMutate(report: { ownerId: string }, actor: Actor) {
    if (actor.role === 'OWNER' || actor.role === 'ADMIN') return;
    if (WRITER_ROLES.includes(actor.role) && report.ownerId === actor.id) return;
    throw new ForbiddenException('Insufficient role for this action');
  }

  private serialize(report: SavedReportRow, actor: Actor) {
    return {
      id: report.id,
      name: report.name,
      ownerId: report.ownerId,
      definition: this.parseDefinition(report.definition),
      archivedAt: report.archivedAt,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      canEdit:
        actor.role !== 'VIEWER' &&
        (actor.role === 'OWNER' || actor.role === 'ADMIN' || report.ownerId === actor.id),
    };
  }
}
