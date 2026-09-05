import { PrismaService } from '../../common/prisma/prisma.service';
import type { OutboxService } from '../outbox/outbox.service';
import { TasksService } from './tasks.service';

const makePrisma = () => {
  const prisma = {
    task: {
      count: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === 'function') {
      return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
  return prisma;
};

const makeOutbox = () =>
  ({
    appendTaskCompleted: jest.fn().mockResolvedValue({
      id: 'evt-task',
      organizationId: 'org-1',
      correlationId: null,
    }),
    dispatch: jest.fn().mockResolvedValue(undefined),
  }) as unknown as OutboxService & {
    appendTaskCompleted: jest.Mock;
    dispatch: jest.Mock;
  };

const openTask = {
  id: 'task-1',
  organizationId: 'org-1',
  status: 'OPEN' as const,
  leadId: 'lead-1',
  campaignId: 'c1',
  campaignStageId: 'stage-1',
  title: 'Ligar para o médico',
  lead: { id: 'lead-1', companyName: 'Medic Saúde', deletedAt: null },
};

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

describe('TasksService.update', () => {
  it('persists task.completed in the DONE transaction and dispatches after commit', async () => {
    const prisma = makePrisma();
    const outbox = makeOutbox();
    prisma.task.findFirst.mockResolvedValue(openTask);
    prisma.task.update.mockResolvedValue({ ...openTask, status: 'DONE', completedAt: new Date() });
    const service = new TasksService(prisma as unknown as PrismaService, outbox);

    const result = await service.update('org-1', 'task-1', 'user-1', { status: 'DONE' });

    expect(result.status).toBe('DONE');
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(outbox.appendTaskCompleted).toHaveBeenCalledTimes(1);
    const [tx, input] = outbox.appendTaskCompleted.mock.calls[0];
    expect(tx).toBe(prisma);
    expect(input).toEqual({
      organizationId: 'org-1',
      taskId: 'task-1',
      actorId: 'user-1',
      payload: {
        taskId: 'task-1',
        leadId: 'lead-1',
        campaignId: 'c1',
        campaignStageId: 'stage-1',
      },
    });
    expect(JSON.stringify(input.payload)).not.toMatch(/email|phone|whatsapp|Ligar|Medic/i);
    expect(outbox.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-task', organizationId: 'org-1' }),
    );
  });

  it('does not emit task.completed when the task is already DONE or status is not DONE', async () => {
    const alreadyDone = makeOutbox();
    const donePrisma = makePrisma();
    donePrisma.task.findFirst.mockResolvedValue({ ...openTask, status: 'DONE' });
    donePrisma.task.update.mockResolvedValue({ ...openTask, status: 'DONE' });
    const doneService = new TasksService(donePrisma as unknown as PrismaService, alreadyDone);
    await doneService.update('org-1', 'task-1', 'user-1', { status: 'DONE' });
    expect(alreadyDone.appendTaskCompleted).not.toHaveBeenCalled();
    expect(alreadyDone.dispatch).not.toHaveBeenCalled();

    const titleOutbox = makeOutbox();
    const titlePrisma = makePrisma();
    titlePrisma.task.findFirst.mockResolvedValue(openTask);
    titlePrisma.task.update.mockResolvedValue({ ...openTask, title: 'Novo título' });
    const titleService = new TasksService(titlePrisma as unknown as PrismaService, titleOutbox);
    await titleService.update('org-1', 'task-1', 'user-1', { title: 'Novo título' });
    expect(titleOutbox.appendTaskCompleted).not.toHaveBeenCalled();
    expect(titleOutbox.dispatch).not.toHaveBeenCalled();
  });

  it('does not dispatch task.completed when the DONE transaction fails', async () => {
    const prisma = makePrisma();
    const outbox = makeOutbox();
    outbox.appendTaskCompleted.mockRejectedValue(new Error('outbox fail'));
    prisma.task.findFirst.mockResolvedValue(openTask);
    prisma.task.update.mockResolvedValue({ ...openTask, status: 'DONE' });
    const service = new TasksService(prisma as unknown as PrismaService, outbox);

    await expect(service.update('org-1', 'task-1', 'user-1', { status: 'DONE' })).rejects.toThrow(
      'outbox fail',
    );
    expect(outbox.dispatch).not.toHaveBeenCalled();
  });
});
