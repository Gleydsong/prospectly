import { RetentionService } from './retention.service';

describe('RetentionService', () => {
  it('clears expired auth secrets and old import error payloads', async () => {
    const prisma = {
      refreshToken: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
      user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      importError: { updateMany: jest.fn().mockResolvedValue({ count: 3 }) },
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
  });
});
