import type { PrismaService } from '../../common/prisma/prisma.service';
import { AUDIT_ACTIONS } from './audit.constants';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  const makePrisma = () => {
    const prisma = {
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'a1' }) },
    };
    return prisma as unknown as PrismaService & {
      auditLog: { create: jest.Mock };
    };
  };

  beforeEach(() => jest.clearAllMocks());

  it('writes minimal audit entries', async () => {
    const prisma = makePrisma();
    const service = new AuditService(prisma);

    await service.log({
      organizationId: 'org1',
      userId: 'u1',
      action: AUDIT_ACTIONS.LEAD_STAGE_CHANGED,
      entity: 'Lead',
      entityId: 'lead1',
      metadata: { fromStageId: 's1', toStageId: 's2' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        userId: 'u1',
        action: AUDIT_ACTIONS.LEAD_STAGE_CHANGED,
        entity: 'Lead',
        entityId: 'lead1',
        metadata: { fromStageId: 's1', toStageId: 's2' },
      }),
    });
  });

  it('redacts secrets, tokens, passwords and CSV bodies from metadata', async () => {
    const prisma = makePrisma();
    const service = new AuditService(prisma);

    await service.log({
      action: AUDIT_ACTIONS.IMPORT_STARTED,
      metadata: {
        password: 'secret-pw',
        accessToken: 'tok',
        temporaryPassword: 'tmp',
        csvContent: 'name,email\na,b',
        fileName: 'leads.csv',
        totalRows: 10,
      },
    });

    const data = prisma.auditLog.create.mock.calls[0][0].data;
    expect(data.metadata).toEqual({
      password: '[redacted]',
      accessToken: '[redacted]',
      temporaryPassword: '[redacted]',
      csvContent: '[redacted]',
      fileName: 'leads.csv',
      totalRows: 10,
    });
  });

  it('does not throw when persistence fails', async () => {
    const prisma = makePrisma();
    prisma.auditLog.create.mockRejectedValue(new Error('db down'));
    const service = new AuditService(prisma);

    await expect(
      service.log({ action: AUDIT_ACTIONS.ORG_SETTINGS_UPDATED, organizationId: 'org1' }),
    ).resolves.toBeUndefined();
  });

  it('sanitizeMetadata returns undefined when omitted', () => {
    const service = new AuditService(makePrisma());
    expect(service.sanitizeMetadata(undefined)).toBeUndefined();
    expect(service.sanitizeMetadata({})).toEqual({});
  });
});
