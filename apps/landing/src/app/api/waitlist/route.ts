import { NextResponse } from 'next/server';

import { joinWaitlistViaApi, resolveWaitlistApiBase } from '@/lib/waitlist-api';

type Body = {
  email?: string;
  locale?: 'pt' | 'en';
  source?: string;
  website?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
  }

  const locale = body.locale === 'en' ? 'en' : 'pt';
  const okMessage =
    locale === 'en'
      ? 'You’re on the waitlist. Check your email.'
      : 'Você entrou na lista de espera. Confira seu e-mail.';

  // Honeypot — pretend success without calling the API
  if (body.website && body.website.trim().length > 0) {
    return NextResponse.json({ message: okMessage });
  }

  const email = (body.email ?? '').trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 160) {
    return NextResponse.json(
      { message: locale === 'en' ? 'Invalid email.' : 'E-mail inválido.' },
      { status: 400 },
    );
  }

  // Always persist + throttle through Nest. Sending mail directly from the landing
  // route bypassed WaitlistEntry storage and Redis rate limits (email bomb).
  const apiBase = resolveWaitlistApiBase();
  if (!apiBase) {
    console.error('WAITLIST_API_URL / NEXT_PUBLIC_API_URL missing');
    return NextResponse.json(
      {
        message:
          locale === 'en'
            ? 'Could not join right now. Please try again in a moment.'
            : 'Não foi possível cadastrar agora. Tente de novo em instantes.',
      },
      { status: 503 },
    );
  }

  const source = (body.source ?? 'landing-home').slice(0, 80);
  const result = await joinWaitlistViaApi({ email, locale, source }, { apiBase });

  return NextResponse.json({ message: result.message }, { status: result.status });
}
