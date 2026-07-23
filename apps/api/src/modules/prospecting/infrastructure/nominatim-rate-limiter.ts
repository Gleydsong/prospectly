export interface NominatimRateLimiter {
  waitForTurn(): Promise<void>;
}

export interface RedisEvalClient {
  eval(script: string, numberOfKeys: number, ...args: string[]): Promise<unknown>;
}

type Sleep = (milliseconds: number) => Promise<void>;

const RESERVE_SLOT_SCRIPT = `
local time = redis.call('TIME')
local now = (tonumber(time[1]) * 1000) + math.floor(tonumber(time[2]) / 1000)
local interval = tonumber(ARGV[1])
local nextSlot = tonumber(redis.call('GET', KEYS[1]) or '0')
local slot = now
if nextSlot > now then
  slot = nextSlot
end
local followingSlot = slot + interval
local ttl = math.max(interval * 2, followingSlot - now + interval)
redis.call('SET', KEYS[1], followingSlot, 'PX', ttl)
return slot - now
`;

const defaultSleep: Sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export class RedisNominatimRateLimiter implements NominatimRateLimiter {
  constructor(
    private readonly redisClient: Promise<RedisEvalClient>,
    private readonly intervalMs = 1_000,
    private readonly sleep: Sleep = defaultSleep,
  ) {}

  async waitForTurn(): Promise<void> {
    const redis = await this.redisClient;
    const delay = Number(
      await redis.eval(
        RESERVE_SLOT_SCRIPT,
        1,
        'prospectly:nominatim:next-slot',
        String(this.intervalMs),
      ),
    );
    if (!Number.isFinite(delay) || delay < 0) {
      throw new Error('Unable to reserve Nominatim rate-limit slot');
    }
    if (delay > 0) {
      await this.sleep(Math.ceil(delay));
    }
  }
}
