import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  it('clears expired auth secrets and old import error payloads', async () => {
    const prisma = {
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      importError: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
      syncedCommunication: { deleteMany: jest.fn(), findMany: jest.fn() },
      lead: { deleteMany: jest.fn() },
    };
    const service = new RetentionService(prisma as never);
    const result = await service.run();
    expect(result.revokedTokens).toBe(2);
    expect(result.expiredTokens).toBe(2);
    expect(result.expiredAuthSecrets).toBe(2);
    expect(result.importErrorsCleared).toBe(3);
    expect(prisma.importError.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ data: expect.anything() }),
      }),
    );
    expect(prisma.syncedCommunication.deleteMany).not.toHaveBeenCalled();
    expect(prisma.syncedCommunication.findMany).not.toHaveBeenCalled();
    expect(prisma.lead.deleteMany).not.toHaveBeenCalled();
  });
});
