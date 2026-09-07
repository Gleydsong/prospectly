import { AccountExportService } from './account-export.service';

describe('AccountExportService', () => {
  it('exports only the authenticated subject and never other-tenant leads', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'owner@example.com',
          name: 'Owner',
          locale: 'pt',
          anonymizedAt: null,
        }),
      },
      organizationMember: { findMany: jest.fn().mockResolvedValue([]) },
      consentRecord: { findMany: jest.fn().mockResolvedValue([]) },
      dataSubjectRequest: { findMany: jest.fn().mockResolvedValue([]) },
      search: { findMany: jest.fn().mockResolvedValue([]) },
      opportunityRun: { findMany: jest.fn().mockResolvedValue([]) },
      aiRun: { findMany: jest.fn().mockResolvedValue([]) },
      googleConnection: { findMany: jest.fn().mockResolvedValue([]) },
      lead: { findMany: jest.fn() },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new AccountExportService(prisma as never, audit as never);

    const payload = await service.exportAccount('u1', 'org-1');

    expect(payload.subject.id).toBe('u1');
    expect(prisma.lead.findMany).not.toHaveBeenCalled();
    expect(prisma.googleConnection.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1' },
        select: {
          organizationId: true,
          googleEmail: true,
          connectedAt: true,
          revokedAt: true,
        },
      }),
    );
    expect(payload.googleConnections).toEqual([]);
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'privacy.data_exported', entityId: 'u1' }),
    );
  });
});
