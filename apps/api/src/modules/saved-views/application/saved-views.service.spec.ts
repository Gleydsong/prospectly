import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CustomFieldType, SavedViewVisibility } from '@prisma/client';

import type { PrismaService } from '../../../common/prisma/prisma.service';
import type { AuditService } from '../../audit/audit.service';
import type { LeadsService } from '../../leads/leads.service';
import { SavedViewsService } from './saved-views.service';

const makePrisma = () => {
  const prisma = {
    savedView: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    customFieldDefinition: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  return prisma as unknown as PrismaService & {
    savedView: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    customFieldDefinition: { findMany: jest.Mock };
  };
};

const makeLeads = () =>
  ({
    list: jest.fn(),
  }) as unknown as LeadsService & { list: jest.Mock };

const makeAudit = () =>
  ({
    log: jest.fn().mockResolvedValue(undefined),
  }) as unknown as AuditService & { log: jest.Mock };

const owner = { id: 'user-1', role: 'SALES' as const };
const teammate = { id: 'user-2', role: 'MEMBER' as const };
const viewer = { id: 'user-3', role: 'VIEWER' as const };

const row = {
  id: 'view-1',
  organizationId: 'org-a',
  ownerId: owner.id,
  name: 'Lisboa sem site',
  description: null,
  visibility: SavedViewVisibility.PRIVATE,
  resourceType: 'LEAD',
  definition: { hasWebsite: false, city: 'Lisboa' },
  archivedAt: null,
  createdAt: new Date('2026-09-05T12:00:00.000Z'),
  updatedAt: new Date('2026-09-05T12:00:00.000Z'),
};

describe('SavedViewsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a private view with a validated definition and records audit', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.savedView.create.mockResolvedValue(row);
    const service = new SavedViewsService(prisma, makeLeads(), audit);

    const created = await service.create('org-a', owner, {
      name: 'Lisboa sem site',
      definition: { hasWebsite: false, city: 'Lisboa' },
    });

    expect(prisma.savedView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          ownerId: owner.id,
          visibility: SavedViewVisibility.PRIVATE,
          definition: { hasWebsite: false, city: 'Lisboa' },
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'saved_view.created', entityId: 'view-1' }),
    );
    expect(created.canEdit).toBe(true);
  });

  it('rejects an unknown definition key before persist', async () => {
    const prisma = makePrisma();
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(
      service.create('org-a', owner, {
        name: 'Hack',
        definition: { email: 'a@b.c' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('creates a view with an allowlisted filter AST', async () => {
    const prisma = makePrisma();
    const definition = {
      filter: {
        op: 'and',
        nodes: [
          { field: 'hasWebsite', op: 'eq', value: false },
          { field: 'lastContactAt', op: 'older_than', days: 14 },
        ],
      },
    };
    prisma.savedView.create.mockResolvedValue({ ...row, definition });
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await service.create('org-a', owner, { name: 'Stale Lisboa', definition });

    expect(prisma.savedView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ definition }),
      }),
    );
  });

  it('rejects mixing filter AST with flat predicates', async () => {
    const prisma = makePrisma();
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(
      service.create('org-a', owner, {
        name: 'Mixed',
        definition: { filter: { field: 'city', op: 'eq', value: 'Lisboa' }, q: 'x' },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('forbids VIEWER from creating a view', async () => {
    const prisma = makePrisma();
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(
      service.create('org-a', viewer, { name: 'X', definition: {} }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('hides another member private view from list and get', async () => {
    const prisma = makePrisma();
    prisma.savedView.findMany.mockResolvedValue([]);
    prisma.savedView.findFirst.mockResolvedValue(row);
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(service.list('org-a', teammate)).resolves.toEqual([]);
    await expect(service.get('org-a', teammate, 'view-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists TEAM views to another member and allows preview through LeadsService.list', async () => {
    const prisma = makePrisma();
    const leads = makeLeads();
    const teamRow = { ...row, visibility: SavedViewVisibility.TEAM };
    prisma.savedView.findMany.mockResolvedValue([teamRow]);
    prisma.savedView.findFirst.mockResolvedValue(teamRow);
    leads.list.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 1, total: 7, totalPages: 7 },
    });
    const service = new SavedViewsService(prisma, leads, makeAudit());

    const listed = await service.list('org-a', teammate);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.canEdit).toBe(false);

    await expect(service.preview('org-a', teammate, 'view-1')).resolves.toEqual({ total: 7 });
    expect(leads.list).toHaveBeenCalledWith(
      'org-a',
      expect.objectContaining({ hasWebsite: false, city: 'Lisboa', page: 1, pageSize: 1 }),
    );
  });

  it('omits archived views from the default list', async () => {
    const prisma = makePrisma();
    prisma.savedView.findMany.mockResolvedValue([]);
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await service.list('org-a', owner);
    expect(prisma.savedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ archivedAt: null }),
      }),
    );
  });

  it('archives a view the owner can edit', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    prisma.savedView.findFirst.mockResolvedValue(row);
    prisma.savedView.update.mockResolvedValue({
      ...row,
      archivedAt: new Date('2026-09-05T13:00:00.000Z'),
    });
    const service = new SavedViewsService(prisma, makeLeads(), audit);

    const archived = await service.archive('org-a', owner, 'view-1');
    expect(archived.archivedAt).toBeTruthy();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'saved_view.archived' }),
    );
  });

  it('duplicates a visible TEAM view as a private copy owned by the actor', async () => {
    const prisma = makePrisma();
    const audit = makeAudit();
    const teamRow = { ...row, visibility: SavedViewVisibility.TEAM };
    const copy = {
      ...teamRow,
      id: 'view-2',
      ownerId: teammate.id,
      name: 'Lisboa sem site (cópia)',
      visibility: SavedViewVisibility.PRIVATE,
    };
    prisma.savedView.findFirst.mockResolvedValue(teamRow);
    prisma.savedView.create.mockResolvedValue(copy);
    const service = new SavedViewsService(prisma, makeLeads(), audit);

    const duplicated = await service.duplicate('org-a', teammate, 'view-1');

    expect(prisma.savedView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          ownerId: teammate.id,
          name: 'Lisboa sem site (cópia)',
          visibility: SavedViewVisibility.PRIVATE,
          definition: { hasWebsite: false, city: 'Lisboa' },
        }),
      }),
    );
    expect(prisma.savedView.update).not.toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'saved_view.duplicated',
        entityId: 'view-2',
        metadata: { sourceId: 'view-1' },
      }),
    );
    expect(duplicated.canEdit).toBe(true);
    expect(duplicated.ownerId).toBe(teammate.id);
  });

  it('forbids VIEWER from duplicating a visible TEAM view', async () => {
    const prisma = makePrisma();
    const teamRow = { ...row, visibility: SavedViewVisibility.TEAM };
    prisma.savedView.findFirst.mockResolvedValue(teamRow);
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(service.duplicate('org-a', viewer, 'view-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('does not duplicate another member private view', async () => {
    const prisma = makePrisma();
    prisma.savedView.findFirst.mockResolvedValue(row);
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(service.duplicate('org-a', teammate, 'view-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('rejects a Vista that references an unknown custom field', async () => {
    const prisma = makePrisma();
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await expect(
      service.create('org-a', owner, {
        name: 'NIF',
        definition: {
          columns: ['companyName', '11111111-1111-4111-8111-111111111111'],
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.savedView.create).not.toHaveBeenCalled();
  });

  it('keeps an archived custom field column and filter on a Vista', async () => {
    const fieldId = '33333333-3333-4333-8333-333333333333';
    const definition = {
      filter: { field: `custom:${fieldId}`, op: 'eq' as const, value: 'legacy' },
      columns: ['companyName', fieldId],
    };
    const prisma = makePrisma();
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { id: fieldId, type: CustomFieldType.TEXT },
    ]);
    prisma.savedView.create.mockResolvedValue({ ...row, definition });
    const service = new SavedViewsService(prisma, makeLeads(), makeAudit());

    await service.create('org-a', owner, { name: 'Legacy NIF', definition });

    expect(prisma.savedView.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ definition }),
      }),
    );
  });
});
