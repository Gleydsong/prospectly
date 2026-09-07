import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role, SavedViewVisibility } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import {
  assertCustomFieldFilter,
  collectCustomFieldFilterIds,
  InvalidLeadFilterError,
} from '../../leads/domain/lead-filter-ast';
import { LeadsService } from '../../leads/leads.service';
import { copiedSavedViewName } from '../domain/copied-saved-view-name';
import {
  collectCustomFieldColumnIds,
  InvalidLeadViewDefinitionError,
  parseLeadViewDefinition,
  type LeadViewDefinition,
} from '../domain/lead-view-definition';
import { CreateSavedViewDto } from '../presentation/dto/create-saved-view.dto';
import { UpdateSavedViewDto } from '../presentation/dto/update-saved-view.dto';

const WRITER_ROLES: Role[] = ['OWNER', 'ADMIN', 'SALES', 'MEMBER'];

type Actor = { id: string; role: Role };

@Injectable()
export class SavedViewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly leads: LeadsService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, actor: Actor, dto: CreateSavedViewDto) {
    this.assertCanWrite(actor);
    const definition = await this.parseDefinition(organizationId, dto.definition);
    const view = await this.prisma.savedView.create({
      data: {
        organizationId,
        ownerId: actor.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        visibility: dto.visibility ?? SavedViewVisibility.PRIVATE,
        definition: definition as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.SAVED_VIEW_CREATED,
      entity: 'SavedView',
      entityId: view.id,
      metadata: { visibility: view.visibility, resourceType: view.resourceType },
    });
    return this.serialize(view, actor);
  }

  async list(organizationId: string, actor: Actor) {
    const rows = await this.prisma.savedView.findMany({
      where: {
        organizationId,
        archivedAt: null,
        OR: [{ ownerId: actor.id }, { visibility: SavedViewVisibility.TEAM }],
      },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.serialize(row, actor));
  }

  async get(organizationId: string, actor: Actor, id: string) {
    const view = await this.requireVisible(organizationId, actor, id, { includeArchived: true });
    return this.serialize(view, actor);
  }

  async update(organizationId: string, actor: Actor, id: string, dto: UpdateSavedViewDto) {
    const view = await this.requireVisible(organizationId, actor, id, { includeArchived: true });
    this.assertCanMutate(view, actor);
    const definition =
      dto.definition === undefined
        ? undefined
        : await this.parseDefinition(organizationId, dto.definition);
    const updated = await this.prisma.savedView.update({
      where: { id: view.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(definition !== undefined ? { definition: definition as Prisma.InputJsonValue } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.SAVED_VIEW_UPDATED,
      entity: 'SavedView',
      entityId: updated.id,
    });
    return this.serialize(updated, actor);
  }

  async archive(organizationId: string, actor: Actor, id: string) {
    const view = await this.requireVisible(organizationId, actor, id, { includeArchived: true });
    this.assertCanMutate(view, actor);
    if (view.archivedAt) {
      return this.serialize(view, actor);
    }
    const archived = await this.prisma.savedView.update({
      where: { id: view.id },
      data: { archivedAt: new Date() },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.SAVED_VIEW_ARCHIVED,
      entity: 'SavedView',
      entityId: archived.id,
    });
    return this.serialize(archived, actor);
  }

  async duplicate(organizationId: string, actor: Actor, id: string) {
    this.assertCanWrite(actor);
    const source = await this.requireVisible(organizationId, actor, id, { includeArchived: true });
    const definition = await this.parseDefinition(organizationId, source.definition);
    const copy = await this.prisma.savedView.create({
      data: {
        organizationId,
        ownerId: actor.id,
        name: copiedSavedViewName(source.name),
        description: source.description,
        visibility: SavedViewVisibility.PRIVATE,
        definition: definition as Prisma.InputJsonValue,
      },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.SAVED_VIEW_DUPLICATED,
      entity: 'SavedView',
      entityId: copy.id,
      metadata: { sourceId: source.id },
    });
    return this.serialize(copy, actor);
  }

  async preview(organizationId: string, actor: Actor, id: string) {
    const view = await this.requireVisible(organizationId, actor, id, { includeArchived: false });
    const definition = await this.parseDefinition(organizationId, view.definition);
    const result = await this.leads.list(organizationId, {
      page: 1,
      pageSize: 1,
      sortBy: definition.sortBy ?? 'createdAt',
      sortOrder: definition.sortOrder ?? 'desc',
      ...definition,
    });
    return { total: result.meta.total };
  }

  private async parseDefinition(organizationId: string, raw: unknown): Promise<LeadViewDefinition> {
    try {
      const definition = parseLeadViewDefinition(raw);
      await this.assertCustomFieldRefs(organizationId, definition);
      return definition;
    } catch (error) {
      if (
        error instanceof InvalidLeadViewDefinitionError ||
        error instanceof InvalidLeadFilterError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async assertCustomFieldRefs(
    organizationId: string,
    definition: LeadViewDefinition,
  ): Promise<void> {
    const ids = [
      ...collectCustomFieldColumnIds(definition.columns),
      ...(definition.filter ? collectCustomFieldFilterIds(definition.filter) : []),
    ];
    if (ids.length === 0) {
      return;
    }
    const unique = [...new Set(ids)];
    const rows = await this.prisma.customFieldDefinition.findMany({
      where: { organizationId, id: { in: unique } },
      select: { id: true, type: true },
    });
    const catalog = new Map(rows.map((row) => [row.id, row.type]));
    for (const id of unique) {
      if (!catalog.has(id)) {
        throw new BadRequestException('Unknown custom field');
      }
    }
    if (definition.filter) {
      assertCustomFieldFilter(definition.filter, catalog);
    }
  }

  private async requireVisible(
    organizationId: string,
    actor: Actor,
    id: string,
    options: { includeArchived: boolean },
  ) {
    const view = await this.prisma.savedView.findFirst({
      where: {
        id,
        organizationId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
    });
    if (!view || !this.canSee(view, actor)) {
      throw new NotFoundException('Saved view not found');
    }
    return view;
  }

  private canSee(
    view: { ownerId: string; visibility: SavedViewVisibility },
    actor: Actor,
  ): boolean {
    return view.ownerId === actor.id || view.visibility === SavedViewVisibility.TEAM;
  }

  private assertCanWrite(actor: Actor) {
    if (!WRITER_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
  }

  private assertCanMutate(
    view: { ownerId: string; visibility: SavedViewVisibility },
    actor: Actor,
  ) {
    this.assertCanWrite(actor);
    if (view.ownerId === actor.id) return;
    if (
      view.visibility === SavedViewVisibility.TEAM &&
      (actor.role === 'OWNER' || actor.role === 'ADMIN')
    ) {
      return;
    }
    throw new ForbiddenException('Insufficient role for this action');
  }

  private serialize(
    view: {
      id: string;
      organizationId: string;
      ownerId: string;
      name: string;
      description: string | null;
      visibility: SavedViewVisibility;
      resourceType: string;
      definition: Prisma.JsonValue;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    },
    actor: Actor,
  ) {
    return {
      id: view.id,
      name: view.name,
      description: view.description,
      visibility: view.visibility,
      resourceType: view.resourceType,
      definition: view.definition,
      archivedAt: view.archivedAt,
      ownerId: view.ownerId,
      createdAt: view.createdAt,
      updatedAt: view.updatedAt,
      canEdit: this.isEditor(view, actor),
    };
  }

  private isEditor(view: { ownerId: string; visibility: SavedViewVisibility }, actor: Actor) {
    try {
      this.assertCanMutate(view, actor);
      return true;
    } catch {
      return false;
    }
  }
}
