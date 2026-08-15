import { PrismaService } from '../../common/prisma/prisma.service';
import { TasksService } from './tasks.service';

describe('TasksService.list', () => {
  it('excludes tasks whose lead is soft-deleted', async () => {
    const prisma = {
      task: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new TasksService(prisma as unknown as PrismaService);

    await service.list('org-1', { page: 1, pageSize: 15 });

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org-1',
          NOT: {
            lead: {
              is: { deletedAt: { not: null } },
            },
          },
        }),
      }),
    );
  });

  it('hides a soft-deleted lead if it still appears in the payload', async () => {
    const prisma = {
      task: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'task-1',
            title: 'Contato',
            lead: {
              id: 'lead-1',
              companyName: 'Medic Saúde',
              deletedAt: new Date('2026-08-14T00:00:00.000Z'),
            },
          },
        ]),
      },
    };
    const service = new TasksService(prisma as unknown as PrismaService);

    const result = await service.list('org-1', { page: 1, pageSize: 15 });

    expect(result.data[0]?.lead).toBeNull();
  });
});
