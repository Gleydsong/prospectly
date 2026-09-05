import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { WorkflowStatus } from '@prisma/client';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import { WorkflowsService } from './workflows.service';

type MockFn = jest.Mock;

const makePrisma = () => {
  const prisma = {
    workflow: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workflowVersion: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma as unknown as PrismaService & {
    workflow: {
      create: MockFn;
      findMany: MockFn;
      findFirst: MockFn;
      update: MockFn;
    };
    workflowVersion: { create: MockFn };
    $transaction: MockFn;
  };
};

const makeAudit = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditService & { log: MockFn };

const owner = { id: 'user-1', role: 'SALES' as const };
const teammate = { id: 'user-2', role: 'MEMBER' as const };
const viewer = { id: 'user-3', role: 'VIEWER' as const };
const admin = { id: 'user-4', role: 'ADMIN' as const };

const definition = {
  trigger: { type: 'lead.created' },
  steps: [{ type: 'add_tag', tagName: 'alto-potencial' }],
};

const draftRow = {
  id: 'wf-1',
  organizationId: 'org-a',
  ownerId: owner.id,
  name: 'Novos leads',
  description: null,
  status: WorkflowStatus.DRAFT,
  draftDefinition: definition,
  publishedVersionId: null,
  archivedAt: null,
  createdAt: new Date('2026-09-05T18:00:00.000Z'),
  updatedAt: new Date('2026-09-05T18:00:00.000Z'),
  versions: [],
};

describe('WorkflowsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a draft Fluxo with a validated definition and records audit', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.workflow.create.mockResolvedValue(draftRow);
    const service = new WorkflowsService(prisma, audit);

    const created = await service.create('org-a', owner, {
      name: 'Novos leads',
      definition,
    });

    expect(prisma.workflow.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          ownerId: owner.id,
          status: WorkflowStatus.DRAFT,
          draftDefinition: definition,
        }),
      }),
    );
    expect(created.executesToday).toBe(false);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.created', entityId: 'wf-1' }),
    );
  });

  it('rejects an unknown trigger on create', async () => {
    const service = new WorkflowsService(makePrisma(), makeAudit());
    await expect(
      service.create('org-a', owner, {
        name: 'Bad',
        definition: { trigger: { type: 'lead.stage_changed' } },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses VIEWER create', async () => {
    const prisma = makePrisma();
    const service = new WorkflowsService(prisma, makeAudit());
    await expect(
      service.create('org-a', viewer, { name: 'Nope', definition }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.workflow.create).not.toHaveBeenCalled();
  });

  it('omits archived Fluxos from the default list', async () => {
    const prisma = makePrisma();
    prisma.workflow.findMany.mockResolvedValue([]);
    const service = new WorkflowsService(prisma, makeAudit());
    await service.list('org-a', owner);
    expect(prisma.workflow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-a', archivedAt: null },
      }),
    );
  });

  it('publishes a draft into an immutable version', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.workflow.findFirst.mockResolvedValue(draftRow);
    prisma.workflowVersion.create.mockResolvedValue({
      id: 'ver-1',
      version: 1,
      definition,
      publishedAt: new Date('2026-09-05T19:00:00.000Z'),
    });
    prisma.workflow.update.mockResolvedValue({
      ...draftRow,
      status: WorkflowStatus.ACTIVE,
      publishedVersionId: 'ver-1',
      versions: [
        {
          id: 'ver-1',
          version: 1,
          definition,
          publishedAt: new Date('2026-09-05T19:00:00.000Z'),
        },
      ],
    });
    const service = new WorkflowsService(prisma, audit);

    const published = await service.publish('org-a', owner, 'wf-1');

    expect(prisma.workflowVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          workflowId: 'wf-1',
          version: 1,
          definition,
        }),
      }),
    );
    expect(published.status).toBe(WorkflowStatus.ACTIVE);
    expect(published.publishedVersion?.version).toBe(1);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.published' }),
    );
  });

  it('refuses to publish a Fluxo with no steps', async () => {
    const prisma = makePrisma();
    prisma.workflow.findFirst.mockResolvedValue({
      ...draftRow,
      draftDefinition: { trigger: { type: 'lead.created' }, steps: [] },
    });
    const service = new WorkflowsService(prisma, makeAudit());
    await expect(service.publish('org-a', owner, 'wf-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.workflowVersion.create).not.toHaveBeenCalled();
  });

  it('refuses definition updates after publish', async () => {
    const prisma = makePrisma();
    prisma.workflow.findFirst.mockResolvedValue({
      ...draftRow,
      status: WorkflowStatus.ACTIVE,
    });
    const service = new WorkflowsService(prisma, makeAudit());
    await expect(service.update('org-a', owner, 'wf-1', { definition })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.workflow.update).not.toHaveBeenCalled();
  });

  it('refuses a teammate editing someone else Fluxo and allows ADMIN', async () => {
    const prisma = makePrisma();
    prisma.workflow.findFirst.mockResolvedValue(draftRow);
    const service = new WorkflowsService(prisma, makeAudit());
    await expect(
      service.update('org-a', teammate, 'wf-1', { name: 'Stolen' }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.workflow.update.mockResolvedValue({ ...draftRow, name: 'Ops' });
    await expect(service.update('org-a', admin, 'wf-1', { name: 'Ops' })).resolves.toEqual(
      expect.objectContaining({ name: 'Ops', canEdit: true }),
    );
  });

  it('returns NotFound when the Fluxo is missing', async () => {
    const prisma = makePrisma();
    prisma.workflow.findFirst.mockResolvedValue(null);
    const service = new WorkflowsService(prisma, makeAudit());
    await expect(service.get('org-a', owner, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('pauses an ACTIVE Fluxo and resumes a PAUSED one', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const activeRow = {
      ...draftRow,
      status: WorkflowStatus.ACTIVE,
      publishedVersionId: 'ver-1',
      versions: [
        {
          id: 'ver-1',
          version: 1,
          definition,
          publishedAt: new Date('2026-09-05T19:00:00.000Z'),
        },
      ],
    };
    prisma.workflow.findFirst.mockResolvedValue(activeRow);
    prisma.workflow.update.mockResolvedValue({ ...activeRow, status: WorkflowStatus.PAUSED });
    const service = new WorkflowsService(prisma, audit);

    await expect(service.pause('org-a', owner, 'wf-1')).resolves.toEqual(
      expect.objectContaining({ status: WorkflowStatus.PAUSED }),
    );
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'workflow.paused' }));

    prisma.workflow.findFirst.mockResolvedValue({ ...activeRow, status: WorkflowStatus.PAUSED });
    prisma.workflow.update.mockResolvedValue(activeRow);
    await expect(service.resume('org-a', owner, 'wf-1')).resolves.toEqual(
      expect.objectContaining({ status: WorkflowStatus.ACTIVE }),
    );
  });

  it('archives a Fluxo and omits it from later lists', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.workflow.findFirst.mockResolvedValue(draftRow);
    prisma.workflow.update.mockResolvedValue({
      ...draftRow,
      status: WorkflowStatus.ARCHIVED,
      archivedAt: new Date('2026-09-05T20:00:00.000Z'),
    });
    const service = new WorkflowsService(prisma, audit);

    await expect(service.archive('org-a', owner, 'wf-1')).resolves.toEqual(
      expect.objectContaining({ status: WorkflowStatus.ARCHIVED }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'workflow.archived' }),
    );
  });
});
