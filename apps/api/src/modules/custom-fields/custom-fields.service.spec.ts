import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CustomFieldType } from '@prisma/client';

import type { PrismaService } from '../../common/prisma/prisma.service';
import { CustomFieldsService, MAX_ACTIVE_FIELDS } from './custom-fields.service';

const makePrisma = () => {
  const prisma = {
    customFieldDefinition: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
  };
  return prisma as unknown as PrismaService & {
    customFieldDefinition: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
    $transaction: jest.Mock;
  };
};

const textRow = {
  id: 'field-nif',
  organizationId: 'org-a',
  name: 'NIF',
  type: CustomFieldType.TEXT,
  position: 0,
  options: [],
  archivedAt: null,
  createdAt: new Date('2026-09-07T00:00:00.000Z'),
  updatedAt: new Date('2026-09-07T00:00:00.000Z'),
};

describe('CustomFieldsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a text field at the next position', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.count.mockResolvedValue(0);
    prisma.customFieldDefinition.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({
      position: 2,
    });
    prisma.customFieldDefinition.create.mockResolvedValue({ ...textRow, position: 3 });
    const service = new CustomFieldsService(prisma);

    const created = await service.create('org-a', { name: 'NIF', type: 'text' });

    expect(prisma.customFieldDefinition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: 'org-a',
          name: 'NIF',
          type: CustomFieldType.TEXT,
          position: 3,
        }),
      }),
    );
    expect(created).toEqual(
      expect.objectContaining({ name: 'NIF', type: 'text', position: 3, archivedAt: null }),
    );
  });

  it('rejects a 21st active field', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.count.mockResolvedValue(MAX_ACTIVE_FIELDS);
    const service = new CustomFieldsService(prisma);

    await expect(service.create('org-a', { name: 'Extra', type: 'text' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.customFieldDefinition.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate active name', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.count.mockResolvedValue(1);
    prisma.customFieldDefinition.findFirst.mockResolvedValue({ id: 'other' });
    const service = new CustomFieldsService(prisma);

    await expect(service.create('org-a', { name: 'NIF', type: 'text' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects changing type after create', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.findFirst.mockResolvedValue(textRow);
    const service = new CustomFieldsService(prisma);

    await expect(service.update('org-a', 'field-nif', { type: 'number' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.customFieldDefinition.update).not.toHaveBeenCalled();
  });

  it('archives a field and refuses writes to its values', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.findFirst.mockResolvedValue(textRow);
    prisma.customFieldDefinition.update.mockResolvedValue({
      ...textRow,
      archivedAt: new Date('2026-09-07T12:00:00.000Z'),
    });
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      { ...textRow, archivedAt: new Date('2026-09-07T12:00:00.000Z') },
    ]);
    const service = new CustomFieldsService(prisma);

    const archived = await service.archive('org-a', 'field-nif');
    expect(archived.archivedAt).toBe('2026-09-07T12:00:00.000Z');

    await expect(
      service.mergeValues('org-a', {}, { 'field-nif': '123' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('clears a value when patched to null or blank', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.findMany.mockResolvedValue([textRow]);
    const service = new CustomFieldsService(prisma);

    await expect(
      service.mergeValues('org-a', { 'field-nif': 'old', other: 1 }, { 'field-nif': null }),
    ).resolves.toEqual({ other: 1 });
    await expect(
      service.mergeValues('org-a', { 'field-nif': 'old' }, { 'field-nif': '   ' }),
    ).resolves.toEqual({});
    expect(prisma.customFieldDefinition.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-a' },
    });
  });

  it('rejects an out-of-range number and an invalid date', async () => {
    const prisma = makePrisma();
    const numberRow = { ...textRow, id: 'field-n', type: CustomFieldType.NUMBER };
    const dateRow = { ...textRow, id: 'field-d', type: CustomFieldType.DATE };
    prisma.customFieldDefinition.findMany.mockResolvedValue([numberRow, dateRow]);
    const service = new CustomFieldsService(prisma);

    await expect(
      service.mergeValues('org-a', {}, { 'field-n': 1e13 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.mergeValues('org-a', {}, { 'field-d': '1899-12-31' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.mergeValues('org-a', {}, { 'field-d': '2026-01-15' })).resolves.toEqual({
      'field-d': '2026-01-15',
    });
    await expect(service.mergeValues('org-a', {}, { 'field-n': 1e-7 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('refuses a new pick of an archived select option but keeps the current value', async () => {
    const prisma = makePrisma();
    const live = { id: 'opt-live', label: 'A', archivedAt: null };
    const dead = { id: 'opt-dead', label: 'B', archivedAt: '2026-09-01T00:00:00.000Z' };
    prisma.customFieldDefinition.findMany.mockResolvedValue([
      {
        ...textRow,
        id: 'field-sel',
        type: CustomFieldType.SELECT,
        options: [live, dead],
      },
    ]);
    const service = new CustomFieldsService(prisma);

    await expect(
      service.mergeValues('org-a', { 'field-sel': live.id }, { 'field-sel': dead.id }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.mergeValues('org-a', { 'field-sel': dead.id }, { 'field-sel': dead.id }),
    ).resolves.toEqual({ 'field-sel': dead.id });
  });

  it('returns 404 when the definition is missing', async () => {
    const prisma = makePrisma();
    prisma.customFieldDefinition.findFirst.mockResolvedValue(null);
    const service = new CustomFieldsService(prisma);

    await expect(service.archive('org-a', 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
