import { createHmac, timingSafeEqual } from 'node:crypto';

const TTL_MS = 10 * 60 * 1000;

type StatePayload = {
  userId: string;
  organizationId: string;
  exp: number;
};

function sign(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function createGoogleOAuthState(
  input: { userId: string; organizationId: string },
  secret: string,
  now = Date.now(),
): string {
  const payload: StatePayload = {
    userId: input.userId,
    organizationId: input.organizationId,
    exp: now + TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body, secret)}`;
}

export function parseGoogleOAuthState(
  state: string,
  secret: string,
  now = Date.now(),
): { userId: string; organizationId: string } {
  const [body, sig] = state.split('.');
  if (!body || !sig) {
    throw new Error('invalid_state');
  }
  const expected = sign(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error('invalid_state');
  }
  const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as StatePayload;
  if (
    typeof parsed.userId !== 'string' ||
    typeof parsed.organizationId !== 'string' ||
    typeof parsed.exp !== 'number'
  ) {
    throw new Error('invalid_state');
  }
  if (parsed.exp < now) {
    throw new Error('expired_state');
  }
  return { userId: parsed.userId, organizationId: parsed.organizationId };
}
