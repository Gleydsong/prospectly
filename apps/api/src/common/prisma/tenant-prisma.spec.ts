import {
  applyTenantGuc,
  modelDelegateName,
  runOnTransactionClient,
} from './tenant-prisma';

describe('tenant Prisma helpers', () => {
  it('maps Prisma model names to client delegates', () => {
    expect(modelDelegateName('OrganizationMember')).toBe('organizationMember');
    expect(modelDelegateName('Lead')).toBe('lead');
  });

  it('applies tenant GUCs on the provided transaction client', async () => {
    const $executeRaw = jest.fn().mockResolvedValue(1);
    await applyTenantGuc({ $executeRaw }, {
      organizationId: 'org-1',
      userId: 'user-1',
      bypass: false,
    });
    expect($executeRaw).toHaveBeenCalledTimes(1);
  });

  it('runs the model operation on the transaction client', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'member-1', role: 'OWNER' });
    const tx = { organizationMember: { findUnique } };

    await expect(
      runOnTransactionClient(tx as never, 'OrganizationMember', 'findUnique', {
        where: { userId_organizationId: { userId: 'user-1', organizationId: 'org-1' } },
      }),
    ).resolves.toEqual({ id: 'member-1', role: 'OWNER' });

    expect(findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: 'user-1', organizationId: 'org-1' } },
    });
  });

  it('rejects unsupported tenant operations instead of falling back', () => {
    expect(() =>
      runOnTransactionClient({} as never, 'OrganizationMember', 'findUnique', {}),
    ).toThrow('Unsupported tenant operation OrganizationMember.findUnique');
  });
});
