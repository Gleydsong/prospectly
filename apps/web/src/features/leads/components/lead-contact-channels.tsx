import { ExternalLink, Globe, Mail, MessageCircle } from 'lucide-react';

import { cn } from '@/lib/utils';
import { sanitizeExternalUrl, sanitizeMailtoHref } from '@/lib/safe-url';

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

/** Fallback PT-BR when i18n is unavailable (pure helper / tests). */
const RECOMMENDED_ACTION_LABELS: Record<string, string> = {
  RESPECT_DNC: 'Respeitar não contatar',
  ENRICH_CONTACT: 'Enriquecer telefone/e-mail',
  RUN_WEBSITE_ANALYSIS: 'Executar análise do site',
  PRIORITIZE_OUTREACH: 'Priorizar contato comercial',
  ADVANCE_PIPELINE: 'Avançar no funil',
  ENRICH_PROFILE: 'Completar perfil do cliente potencial',
  NURTURE: 'Nutrir relacionamento',
};

export const INTERNAL_CRM_ACTION_CODES = new Set([
  'RESPECT_DNC',
  'ENRICH_CONTACT',
  'RUN_WEBSITE_ANALYSIS',
  'PRIORITIZE_OUTREACH',
  'ADVANCE_PIPELINE',
  'ENRICH_PROFILE',
  'NURTURE',
  'FOLLOW_UP_OVERDUE',
]);

const INTERNAL_CRM_ACTION_LABELS = new Set(
  Object.values(RECOMMENDED_ACTION_LABELS).map((label) => label.toLowerCase()),
);

export function isInternalCrmAction(action: string): boolean {
  const trimmed = action.trim();
  if (INTERNAL_CRM_ACTION_CODES.has(trimmed.toUpperCase())) return true;
  if (INTERNAL_CRM_ACTION_LABELS.has(trimmed.toLowerCase())) return true;
  return false;
}

export function humanizeRecommendedAction(action: string): string {
  const key = action.trim();
  return RECOMMENDED_ACTION_LABELS[key] ?? key;
}

/**
 * Mensagem sugerida para outreach (contexto do lead + ação recomendada).
 * Sem chamada LLM extra no MVP — usa regras/score já calculados.
 * Ações internas do sistema CRM (ex: ADVANCE_PIPELINE) nunca vazam para o cliente.
 */
export function buildWhatsAppOutreachMessage(lead: LeadContactChannelInput): string {
  const city = lead.city?.trim() ? ` em ${lead.city.trim()}` : '';
  const rawAction = lead.recommendedAction?.trim();
  const isInternal = rawAction ? isInternalCrmAction(rawAction) : true;
  const tip = !isInternal && rawAction ? humanizeRecommendedAction(rawAction) : undefined;
  if (tip) {
    return `Olá! Vi a ${lead.companyName}${city} e queria compartilhar uma ideia: ${tip} Posso enviar mais detalhes?`;
  }
  return `Olá! Vi a ${lead.companyName}${city} e gostaria de conversar sobre como podemos ajudar no seu negócio. Tem 2 minutos para falar?`;
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
  onOpenWhatsAppModal?: () => void;
}

/**
 * Chips de contato acionáveis: mailto, website e WhatsApp (wa.me + mensagem).
 * Sem verificação oficial “tem WhatsApp?” — Cloud API não oferece isso.
 */
export function LeadContactChannels({ lead, className, onOpenWhatsAppModal }: LeadContactChannelsProps) {
  const blocked = Boolean(lead.doNotContact);
  const email = lead.email?.trim() || null;
  const emailHref = email ? sanitizeMailtoHref(email) : null;
  const websiteHref = lead.website ? sanitizeExternalUrl(lead.website) : null;
  const whatsappRaw = (lead.whatsapp?.trim() || lead.phone?.trim() || '') || null;
  const message = buildWhatsAppOutreachMessage(lead);
  const whatsappHref =
    !blocked && whatsappRaw ? buildWhatsAppHref(whatsappRaw, message) : null;

  const emailTone: ChannelTone = blocked ? 'blocked' : emailHref ? 'ready' : 'missing';
  const websiteTone: ChannelTone = websiteHref ? 'ready' : 'missing';
  const whatsappTone: ChannelTone = blocked ? 'blocked' : whatsappHref ? 'ready' : 'missing';

  return (
    <div className={cn('mt-3', className)}>
      <p className="mb-1 text-xs font-medium uppercase text-zinc-400">Canais de contato</p>
      <div className="flex flex-wrap gap-1.5">
        {emailHref && !blocked ? (
          <a
            href={emailHref}
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
            title={blocked ? 'Cliente potencial marcado como não contatar' : 'E-mail não cadastrado'}
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
            title="Abrir site"
          >
            <Globe className="h-3 w-3" aria-hidden />
            Site
            <ExternalLink className="h-3 w-3 opacity-70" aria-hidden />
          </a>
        ) : (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium',
              channelClass(websiteTone),
            )}
            title="Site não cadastrado"
          >
            <Globe className="h-3 w-3" aria-hidden />
            Site
          </span>
        )}

        {whatsappTone === 'ready' && onOpenWhatsAppModal ? (
          <button
            type="button"
            onClick={onOpenWhatsAppModal}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors',
              channelClass(whatsappTone),
            )}
            title="Abrir assistente de abordagem WhatsApp"
          >
            <MessageCircle className="h-3 w-3" aria-hidden />
            WhatsApp
          </button>
        ) : whatsappHref ? (
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
                ? 'Cliente potencial marcado como não contatar'
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
