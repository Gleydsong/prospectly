import { ConfigService } from '@nestjs/config';

import { RedisThrottlerStorage } from './redis-throttler.storage';

const evalMock = jest.fn();
const quitMock = jest.fn().mockResolvedValue('OK');

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    eval: evalMock,
    quit: quitMock,
  })),
);

function storage() {
  return new RedisThrottlerStorage({
    getOrThrow: () => 'redis://127.0.0.1:6379/0',
  } as unknown as ConfigService);
}

describe('RedisThrottlerStorage', () => {
  beforeEach(() => {
    evalMock.mockReset();
    quitMock.mockClear();
  });

  it('applies hit and block TTLs in one Redis script', async () => {
    evalMock.mockResolvedValue([2, 45_000, 0, 0]);
    const result = await storage().increment('ip:1', 60_000, 120, 0, 'default');
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('PEXPIRE'"),
      2,
      'throttle:default:ip:1',
      'throttle:block:default:ip:1',
      '60000',
      '120',
      '60000',
    );
    expect(result).toEqual({
      totalHits: 2,
      timeToExpire: 45,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('fails open when Redis is down so HTTP does not depend on the accelerator', async () => {
    evalMock.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(storage().increment('ip:1', 60_000, 120, 0, 'default')).resolves.toEqual({
      totalHits: 1,
      timeToExpire: 60,
      isBlocked: false,
      timeToBlockExpire: 0,
    });
  });

  it('fails open on Redis timeout', async () => {
    evalMock.mockRejectedValue(new Error('Command timed out'));
    await expect(storage().increment('ip:1', 1_000, 5, 0, 'default')).resolves.toMatchObject({
      isBlocked: false,
    });
  });
});
