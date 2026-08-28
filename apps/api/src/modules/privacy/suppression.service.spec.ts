import { hashSuppressionValue, SuppressionService } from './suppression.service';

const makePrisma = () => {
  const prisma = {
    suppressionEntry: {
      findFirst: jest.fn(),
      createMany: jest.fn(),
    },
    lead: { findFirst: jest.fn() },
  };
  return prisma;
};

describe('SuppressionService', () => {
  it('hashes canonical email/phone without storing plaintext', () => {
    const emailHash = hashSuppressionValue('EMAIL', '  Contato@Padaria.EXAMPLE ');
    const phoneHash = hashSuppressionValue('PHONE', '+55 (11) 99999-0000');
    expect(emailHash).toBe(hashSuppressionValue('EMAIL', 'contato@padaria.example'));
    expect(phoneHash).toBe(hashSuppressionValue('PHONE', '5511999990000'));
    expect(emailHash).not.toMatch(/padaria/i);
    expect(phoneHash).not.toMatch(/99999/);
  });

  it('blocks reimport when a hash already exists', async () => {
    const prisma = makePrisma();
    prisma.suppressionEntry.findFirst.mockResolvedValue({ id: 's1' });
    const service = new SuppressionService(prisma as never);

    await expect(
      service.isSuppressed('org-1', { email: 'optout@example.com' }),
    ).resolves.toBe(true);
    expect(prisma.suppressionEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('writes hashed identifiers only', async () => {
    const prisma = makePrisma();
    prisma.suppressionEntry.createMany.mockResolvedValue({ count: 1 });
    const service = new SuppressionService(prisma as never);

    await service.suppressIdentifiers(
      'org-1',
      { email: 'optout@example.com' },
      'campaign_opt_out',
    );

    const payload = prisma.suppressionEntry.createMany.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain('optout@example.com');
    expect(payload.data[0].valueHash).toBe(hashSuppressionValue('EMAIL', 'optout@example.com'));
    expect(payload.data[0].kind).toBe('EMAIL');
  });
});
