import { RedisNominatimRateLimiter } from './nominatim-rate-limiter';

describe('RedisNominatimRateLimiter', () => {
  it('uses one atomic Redis script and waits for the globally reserved slot', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(250) };
    const sleep = jest.fn().mockResolvedValue(undefined);
    const limiter = new RedisNominatimRateLimiter(Promise.resolve(redis), 1_000, sleep);

    await limiter.waitForTurn();

    expect(redis.eval).toHaveBeenCalledWith(expect.stringContaining("redis.call('TIME')"), 1, 'prospectly:nominatim:next-slot', '1000');
    expect(sleep).toHaveBeenCalledWith(250);
  });

  it('does not sleep when Redis grants the current slot', async () => {
    const redis = { eval: jest.fn().mockResolvedValue(0) };
    const sleep = jest.fn();

    await new RedisNominatimRateLimiter(Promise.resolve(redis), 1_000, sleep).waitForTurn();

    expect(sleep).not.toHaveBeenCalled();
  });
});
