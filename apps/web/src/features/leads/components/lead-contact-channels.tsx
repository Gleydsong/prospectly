import { ExternalLink, Globe, Mail, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { sanitizeExternalUrl } from '@/lib/safe-url';

export type LeadContactChannelInput = {
  companyName: string;
  email?: string | null;
  website?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  city?: string | null;
  doNotContact?: boolean;
  /** Dica do score / regras — usada como base da mensagem. */
  recommendedAction?: string | null;
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** Número E.164-ish para wa.me (só dígitos, com DDI quando possível). */
export function toWhatsAppDigits(raw: string): string | null {
  const digits = digitsOnly(raw);
  if (digits.length < 8) return null;
  return digits;
}

/**
 * Mensagem sugerida para outreach (contexto do lead + ação recomendada).
 * Sem chamada LLM extra no MVP — usa regras/score já calculados.
 */
export function buildWhatsAppOutreachMessage(lead: LeadContactChannelInput): string {
  const city = lead.city?.trim() ? ` em ${lead.city.trim()}` : '';
  const tip = lead.recommendedAction?.trim();
  if (tip) {
    return `Olá! Vi a ${lead.companyName}${city} e queria partilhar uma ideia: ${tip} Posso enviar mais detalhes?`;
  }
  return `Olá! Vi a ${lead.companyName}${city} e gostaria de conversar sobre como podemos ajudar no vosso negócio. Tem 2 minutos para falar?`;
}

export function buildWhatsAppHref(phoneRaw: string, message: string): string | null {
  const digits = toWhatsAppDigits(phoneRaw);
  if (!digits) return null;
  const text = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${text}`;
}

type ChannelTone = 'ready' | 'missing' | 'blocked';

function channelClass(tone: ChannelTone): string {
  if (tone === 'ready') {
    return 'border-brand-500/35 bg-brand-500/15 text-brand-200 hover:border-brand-400/50 hover:bg-brand-500/25';
  }
  if (tone === 'blocked') {
    return 'cursor-not-allowed border-red-500/25 bg-red-500/10 text-red-300/80';
  }
  return 'cursor-not-allowed border-amber-500/25 bg-amber-500/10 text-amber-300/80';
}

interface LeadContactChannelsProps {
  lead: LeadContactChannelInput;
  className?: string;
}

/**
 * Chips de contacto acionáveis: mailto, website e WhatsApp (wa.me + mensagem).
 * Sem verificação oficial “tem WhatsApp?” — Cloud API não oferece isso.
 */
export function LeadContactChannels({ lead, className }: LeadContactChannelsProps) {
  const blocked = Boolean(lead.doNotContact);
  const email = lead.email?.trim() || null;
  const websiteHref = lead.website ? sanitizeExternalUrl(lead.website) : null;
  const whatsappRaw = (lead.whatsapp?.trim() || lead.phone?.trim() || '') || null;
  const message = buildWhatsAppOutreachMessage(lead);
  const whatsappHref =
    !blocked && whatsappRaw ? buildWhatsAppHref(whatsappRaw, message) : null;

  const emailTone: ChannelTone = blocked ? 'blocked' : email ? 'ready' : 'missing';
  const websiteTone: ChannelTone = websiteHref ? 'ready' : 'missing';
  const whatsappTone: ChannelTone = blocked ? 'blocked' : whatsappHref ? 'ready' : 'missing';

  return (
    <div className={cn('mt-3', className)}>
      <p className="mb-1 text-xs font-medium uppercase text-zinc-400">Canais de contacto</p>
      <div className="flex flex-wrap gap-1.5">
        {email && !blocked ? (
          <a
            href={`mailto:${email}`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              channelClass(emailTone),
            )}
            title={`Abrir e-mail para ${email}`}
          >
            <Mail className="h-3 w-3" aria-hidden />
            E-mail
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              channelClass(emailTone),
            )}
            title={blocked ? 'Lead marcado como não contatar' : 'E-mail não cadastrado'}
          >
            <Mail className="h-3 w-3" aria-hidden />
            E-mail
          </span>
        )}

        {websiteHref ? (
          <a
            href={websiteHref}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              channelClass(websiteTone),
            )}
            title="Abrir website"
          >
            <Globe className="h-3 w-3" aria-hidden />
            Website
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              channelClass(websiteTone),
            )}
            title="Website não cadastrado"
          >
            <Globe className="h-3 w-3" aria-hidden />
            Website
          </span>
        )}

        {whatsappHref ? (
          <a
            href={whatsappHref}
            target="_blank"
            rel="noreferrer noopener"
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              channelClass(whatsappTone),
            )}
            title="Abrir WhatsApp com mensagem sugerida (sem verificação prévia oficial)"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            WhatsApp
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              channelClass(whatsappTone),
            )}
            title={
              blocked
                ? 'Lead marcado como não contatar'
                : 'Telefone/WhatsApp não cadastrado'
            }
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            WhatsApp
          </span>
        )}
      </div>
      {whatsappHref ? (
        <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
          WhatsApp abre com mensagem sugerida. A Meta não confirma se o número tem WhatsApp
          antes do envio.
        </p>
      ) : null}
    </div>
  );
}
