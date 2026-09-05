import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type Role, WorkflowStatus } from '@prisma/client';

import { PrismaService } from '../../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from '../../audit/audit.constants';
import { AuditService } from '../../audit/audit.service';
import { CreateWorkflowDto } from '../presentation/dto/create-workflow.dto';
import { UpdateWorkflowDto } from '../presentation/dto/update-workflow.dto';
import {
  InvalidWorkflowDefinitionError,
  parseWorkflowDefinition,
  type WorkflowDefinition,
} from '../domain/workflow-definition';

const WRITER_ROLES: Role[] = ['OWNER', 'ADMIN', 'SALES', 'MEMBER'];

type Actor = { id: string; role: Role };

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(organizationId: string, actor: Actor, dto: CreateWorkflowDto) {
    this.assertCanWrite(actor);
    const definition = this.parseDefinition(dto.definition);
    const workflow = await this.prisma.workflow.create({
      data: {
        organizationId,
        ownerId: actor.id,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        status: WorkflowStatus.DRAFT,
        draftDefinition: definition as Prisma.InputJsonValue,
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_CREATED,
      entity: 'Workflow',
      entityId: workflow.id,
      metadata: { status: workflow.status },
    });
    return this.serialize(workflow, actor);
  }

  async list(organizationId: string, actor: Actor) {
    const rows = await this.prisma.workflow.findMany({
      where: { organizationId, archivedAt: null },
      orderBy: { updatedAt: 'desc' },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    return rows.map((row) => this.serialize(row, actor));
  }

  async get(organizationId: string, actor: Actor, id: string) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: true });
    return this.serialize(workflow, actor);
  }

  async update(organizationId: string, actor: Actor, id: string, dto: UpdateWorkflowDto) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: true });
    this.assertCanMutate(workflow, actor);
    if (dto.definition !== undefined && workflow.status !== WorkflowStatus.DRAFT) {
      throw new BadRequestException('Definition can only be updated while the Fluxo is a draft');
    }
    const definition =
      dto.definition === undefined ? undefined : this.parseDefinition(dto.definition);
    const updated = await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(definition !== undefined
          ? { draftDefinition: definition as Prisma.InputJsonValue }
          : {}),
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_UPDATED,
      entity: 'Workflow',
      entityId: updated.id,
    });
    return this.serialize(updated, actor);
  }

  async publish(organizationId: string, actor: Actor, id: string) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: false });
    this.assertCanMutate(workflow, actor);
    if (workflow.status !== WorkflowStatus.DRAFT) {
      throw new BadRequestException('Only a draft Fluxo can be published');
    }
    const definition = this.parseDefinition(workflow.draftDefinition);
    if (definition.steps.length < 1) {
      throw new BadRequestException('Publish requires at least one step');
    }
    const nextVersion = (workflow.versions[0]?.version ?? 0) + 1;
    const publishedAt = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const version = await tx.workflowVersion.create({
        data: {
          organizationId,
          workflowId: workflow.id,
          version: nextVersion,
          definition: definition as Prisma.InputJsonValue,
          publishedAt,
        },
      });
      return tx.workflow.update({
        where: { id: workflow.id },
        data: {
          status: WorkflowStatus.ACTIVE,
          publishedVersionId: version.id,
        },
        include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
      });
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_PUBLISHED,
      entity: 'Workflow',
      entityId: updated.id,
      metadata: { version: nextVersion },
    });
    return this.serialize(updated, actor);
  }

  async pause(organizationId: string, actor: Actor, id: string) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: false });
    this.assertCanMutate(workflow, actor);
    if (workflow.status !== WorkflowStatus.ACTIVE && workflow.status !== WorkflowStatus.PAUSED) {
      throw new BadRequestException('Only an active Fluxo can be paused');
    }
    if (workflow.status === WorkflowStatus.PAUSED) {
      return this.serialize(workflow, actor);
    }
    const updated = await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { status: WorkflowStatus.PAUSED },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_PAUSED,
      entity: 'Workflow',
      entityId: updated.id,
    });
    return this.serialize(updated, actor);
  }

  async resume(organizationId: string, actor: Actor, id: string) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: false });
    this.assertCanMutate(workflow, actor);
    if (workflow.status !== WorkflowStatus.PAUSED) {
      throw new BadRequestException('Only a paused Fluxo can be resumed');
    }
    const updated = await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { status: WorkflowStatus.ACTIVE },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_UPDATED,
      entity: 'Workflow',
      entityId: updated.id,
      metadata: { status: WorkflowStatus.ACTIVE },
    });
    return this.serialize(updated, actor);
  }

  async archive(organizationId: string, actor: Actor, id: string) {
    const workflow = await this.requireVisible(organizationId, id, { includeArchived: true });
    this.assertCanMutate(workflow, actor);
    if (workflow.archivedAt) {
      return this.serialize(workflow, actor);
    }
    const archived = await this.prisma.workflow.update({
      where: { id: workflow.id },
      data: { status: WorkflowStatus.ARCHIVED, archivedAt: new Date() },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.audit.log({
      organizationId,
      userId: actor.id,
      action: AUDIT_ACTIONS.WORKFLOW_ARCHIVED,
      entity: 'Workflow',
      entityId: archived.id,
    });
    return this.serialize(archived, actor);
  }

  private parseDefinition(raw: unknown): WorkflowDefinition {
    try {
      return parseWorkflowDefinition(raw);
    } catch (error) {
      if (error instanceof InvalidWorkflowDefinitionError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private async requireVisible(
    organizationId: string,
    id: string,
    options: { includeArchived: boolean },
  ) {
    const workflow = await this.prisma.workflow.findFirst({
      where: {
        id,
        organizationId,
        ...(options.includeArchived ? {} : { archivedAt: null }),
      },
      include: { versions: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!workflow) {
      throw new NotFoundException('Fluxo not found');
    }
    return workflow;
  }

  private assertCanWrite(actor: Actor) {
    if (!WRITER_ROLES.includes(actor.role)) {
      throw new ForbiddenException('Insufficient role for this action');
    }
  }

  private assertCanMutate(workflow: { ownerId: string }, actor: Actor) {
    this.assertCanWrite(actor);
    if (workflow.ownerId === actor.id) return;
    if (actor.role === 'OWNER' || actor.role === 'ADMIN') return;
    throw new ForbiddenException('Insufficient role for this action');
  }

  private serialize(
    workflow: {
      id: string;
      organizationId: string;
      ownerId: string;
      name: string;
      description: string | null;
      status: WorkflowStatus;
      draftDefinition: Prisma.JsonValue;
      publishedVersionId: string | null;
      archivedAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      versions: Array<{
        id: string;
        version: number;
        definition: Prisma.JsonValue;
        publishedAt: Date;
      }>;
    },
    actor: Actor,
  ) {
    const published = workflow.versions[0];
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      status: workflow.status,
      draftDefinition: workflow.draftDefinition,
      publishedVersion: published
        ? {
            id: published.id,
            version: published.version,
            definition: published.definition,
            publishedAt: published.publishedAt,
          }
        : null,
      archivedAt: workflow.archivedAt,
      ownerId: workflow.ownerId,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
      canEdit: this.isEditor(workflow, actor),
      executesToday: false,
    };
  }

  private isEditor(workflow: { ownerId: string }, actor: Actor) {
    try {
      this.assertCanMutate(workflow, actor);
      return true;
    } catch {
      return false;
    }
  }
}
