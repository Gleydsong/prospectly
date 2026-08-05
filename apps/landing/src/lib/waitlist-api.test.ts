import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { joinWaitlistViaApi, resolveWaitlistApiBase } from './waitlist-api';

describe('resolveWaitlistApiBase', () => {
  it('prefers WAITLIST_API_URL and strips trailing slash', () => {
    assert.equal(
      resolveWaitlistApiBase({
        WAITLIST_API_URL: 'https://api.example/api/v1/',
        NEXT_PUBLIC_API_URL: 'https://ignored/api/v1',
      }),
      'https://api.example/api/v1',
    );
  });

  it('falls back to NEXT_PUBLIC_API_URL', () => {
    assert.equal(
      resolveWaitlistApiBase({
        NEXT_PUBLIC_API_URL: 'http://localhost:3000/api/v1',
      }),
      'http://localhost:3000/api/v1',
    );
  });

  it('returns null when unset', () => {
    assert.equal(resolveWaitlistApiBase({}), null);
  });
});

describe('joinWaitlistViaApi', () => {
  it('posts to Nest waitlist and returns API message', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(JSON.stringify({ message: 'ok-from-api' }), { status: 200 });
    };

    const result = await joinWaitlistViaApi(
      { email: 'ana@agency.dev', locale: 'en', source: 'landing-home' },
      { apiBase: 'http://api.test/api/v1', fetchImpl },
    );

    assert.equal(result.status, 200);
    assert.equal(result.message, 'ok-from-api');
    assert.equal(calls.length, 1);
    assert.equal(calls[0]?.url, 'http://api.test/api/v1/waitlist');
    assert.equal(calls[0]?.init?.method, 'POST');
    assert.equal(
      calls[0]?.init?.body,
      JSON.stringify({
        email: 'ana@agency.dev',
        locale: 'en',
        source: 'landing-home',
        website: undefined,
      }),
    );
  });

  it('maps network failures to 502 without sending local mail', async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error('ECONNREFUSED');
    };

    const result = await joinWaitlistViaApi(
      { email: 'ana@agency.dev', locale: 'pt' },
      { apiBase: 'http://api.test/api/v1', fetchImpl },
    );

    assert.equal(result.status, 502);
    assert.match(result.message, /Não foi possível/);
  });

  it('maps 429 from Nest to a clear rate-limit message', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'ThrottlerException' }), { status: 429 });

    const result = await joinWaitlistViaApi(
      { email: 'ana@agency.dev', locale: 'en' },
      { apiBase: 'http://api.test/api/v1', fetchImpl },
    );

    assert.equal(result.status, 429);
    assert.match(result.message, /Too many attempts/);
  });
});
