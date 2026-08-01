type WaitlistLocale = 'pt' | 'en';

export type WaitlistJoinPayload = {
  email: string;
  locale: WaitlistLocale;
  source?: string;
  website?: string;
};

export type WaitlistJoinResponse = {
  status: number;
  message: string;
};

/**
 * Resolve the Nest waitlist base URL (`.../api/v1`).
 * Prefer server-only WAITLIST_API_URL; fall back to NEXT_PUBLIC_API_URL.
 */
export function resolveWaitlistApiBase(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const raw = (env.WAITLIST_API_URL ?? env.NEXT_PUBLIC_API_URL ?? '').trim();
  if (!raw) return null;
  return raw.replace(/\/$/, '');
}

export async function joinWaitlistViaApi(
  payload: WaitlistJoinPayload,
  options: {
    apiBase: string;
    fetchImpl?: typeof fetch;
  },
): Promise<WaitlistJoinResponse> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const locale = payload.locale === 'en' ? 'en' : 'pt';
  const fallbackOk =
    locale === 'en'
      ? 'You’re on the waitlist. Check your email.'
      : 'Você entrou na lista de espera. Confira seu e-mail.';
  const fallbackError =
    locale === 'en'
      ? 'Could not join right now. Please try again in a moment.'
      : 'Não foi possível cadastrar agora. Tente de novo em instantes.';

  let response: Response;
  try {
    response = await fetchImpl(`${options.apiBase}/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email: payload.email,
        locale,
        source: payload.source,
        website: payload.website,
      }),
    });
  } catch {
    return { status: 502, message: fallbackError };
  }

  const data = (await response.json().catch(() => null)) as { message?: string } | null;
  if (response.ok) {
    return { status: response.status, message: data?.message ?? fallbackOk };
  }

  if (response.status === 429) {
    return {
      status: 429,
      message:
        locale === 'en'
          ? 'Too many attempts. Please try again shortly.'
          : 'Muitas tentativas. Tente de novo em instantes.',
    };
  }

  return {
    status: response.status >= 400 && response.status < 600 ? response.status : 502,
    message: data?.message ?? fallbackError,
  };
}
