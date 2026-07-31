import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import { buildWaitlistConfirmationEmail } from '@/lib/waitlist-email';

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

  // Honeypot
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY missing');
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

  const from = process.env.RESEND_FROM ?? 'Prospectly <onboarding@resend.dev>';
  const source = (body.source ?? 'landing-home').slice(0, 80);
  const resend = new Resend(apiKey);
  const confirmation = buildWaitlistConfirmationEmail(locale);

  try {
    const { error } = await resend.emails.send({
      from,
      to: email,
      subject: confirmation.subject,
      text: confirmation.text,
      html: confirmation.html,
    });
    if (error) {
      console.error('Resend confirmation failed', error);
      return NextResponse.json(
        {
          message:
            locale === 'en'
              ? 'Could not join right now. Please try again in a moment.'
              : 'Não foi possível cadastrar agora. Tente de novo em instantes.',
        },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error('Resend confirmation threw', err);
    return NextResponse.json(
      {
        message:
          locale === 'en'
            ? 'Could not join right now. Please try again in a moment.'
            : 'Não foi possível cadastrar agora. Tente de novo em instantes.',
      },
      { status: 502 },
    );
  }

  const notifyTo = process.env.WAITLIST_NOTIFY_TO?.trim();
  if (notifyTo) {
    try {
      await resend.emails.send({
        from,
        to: notifyTo,
        subject: `Novo waitlist: ${email}`,
        text: `Novo cadastro na lista de espera.\n\nE-mail: ${email}\nLocale: ${locale}\nSource: ${source}\n`,
        html: `<p>Novo cadastro na lista de espera.</p><p><strong>E-mail:</strong> ${email}<br/><strong>Locale:</strong> ${locale}<br/><strong>Source:</strong> ${source}</p>`,
      });
    } catch (err) {
      console.error('Resend notify failed', err);
    }
  }

  return NextResponse.json({ message: okMessage });
}
