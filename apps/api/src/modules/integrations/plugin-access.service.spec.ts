import { PluginAccessService } from './plugin-access.service';

describe('PluginAccessService', () => {
  it('creates a token and stores only its hash', async () => {
    const prisma = {
      pluginToken: {
        create: jest.fn().mockImplementation(async ({ data }: { data: Record<string, string> }) => ({
          id: 'token_1', name: data.name, tokenPrefix: data.tokenPrefix, createdAt: new Date(),
        })),
      },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new PluginAccessService(prisma as never);

    const result = await service.createToken('org_1', 'user_1', 'Cursor');

    expect(result.token).toMatch(/^pst_/);
    expect(prisma.pluginToken.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ organizationId: 'org_1', name: 'Cursor' }),
    }));
    const createData = prisma.pluginToken.create.mock.calls[0][0].data;
    expect(createData.tokenHash).not.toContain(result.token);
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('resolves a valid key and returns only the organization scope', async () => {
    const prisma = {
      pluginToken: {
        findUnique: jest.fn().mockResolvedValue({ id: 'token_1', organizationId: 'org_1', revokedAt: null }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new PluginAccessService(prisma as never);
    await expect(service.resolveOrganization('pst_test-key')).resolves.toBe('org_1');
    expect(prisma.pluginToken.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'token_1' } }));
  });
});
