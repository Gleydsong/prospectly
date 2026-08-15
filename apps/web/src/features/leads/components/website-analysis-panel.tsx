import { CheckCircle2, Globe2, Loader2, ShieldAlert, Sparkles } from 'lucide-react';

import { cn } from '@/lib/utils';

type AnalysisIssue = {
  id: string;
  code: string;
  severity: string;
  message: string;
};

export type LeadWebsiteAnalysis = {
  id: string;
  status: string;
  httpStatus?: number | null;
  https?: boolean | null;
  responseTimeMs?: number | null;
  title?: string | null;
  hasViewport?: boolean | null;
  hasContactForm?: boolean | null;
  completedAt?: string | null;
  issues: AnalysisIssue[];
};

type Tone = 'idle' | 'pending' | 'ok' | 'warn' | 'fail';

function speedLabel(ms?: number | null): string {
  if (ms == null) return '—';
  if (ms < 400) return 'Rápida';
  if (ms < 1200) return 'Boa';
  if (ms < 3000) return 'Lenta';
  return 'Muito lenta';
}

function resolveTone(analysis: LeadWebsiteAnalysis | null | undefined, hasWebsite: boolean): Tone {
  if (!hasWebsite) return 'idle';
  if (!analysis) return 'idle';
  if (analysis.status === 'PENDING' || analysis.status === 'RUNNING') return 'pending';
  if (analysis.status === 'FAILED') return 'fail';
  if (analysis.status === 'COMPLETED') {
    const critical = analysis.issues.some((i) => i.severity === 'CRITICAL');
    if (critical || analysis.https === false) return 'warn';
    return 'ok';
  }
  return 'idle';
}

const BANNER: Record<
  Tone,
  { title: string; body: string; icon: typeof Sparkles; shell: string; iconClass: string }
> = {
  idle: {
    title: 'Ainda não verificamos este site',
    body: 'Quando quiser, clique em Reanalisar para checar se o site abre e como ele se apresenta.',
    icon: Globe2,
    shell: 'border-white/10 bg-white/[0.03]',
    iconClass: 'text-zinc-400',
  },
  pending: {
    title: 'Verificando o site agora…',
    body: 'Isso costuma levar poucos segundos. Os resultados aparecem automaticamente aqui.',
    icon: Loader2,
    shell: 'border-brand-400/25 bg-brand-500/[0.08]',
    iconClass: 'text-brand-300 animate-spin',
  },
  ok: {
    title: 'Site acessível',
    body: 'Conseguimos abrir o endereço. Abaixo está um resumo simples do que encontramos.',
    icon: CheckCircle2,
    shell: 'border-emerald-400/25 bg-emerald-500/[0.08]',
    iconClass: 'text-emerald-300',
  },
  warn: {
    title: 'Site acessível, com pontos de atenção',
    body: 'O endereço abre, mas há melhorias importantes — por exemplo segurança ou experiência no celular.',
    icon: Sparkles,
    shell: 'border-amber-400/25 bg-amber-500/[0.08]',
    iconClass: 'text-amber-300',
  },
  fail: {
    title: 'Não foi possível verificar agora',
    body: 'O site não respondeu ou a verificação falhou. Você pode tentar de novo em instantes.',
    icon: ShieldAlert,
    shell: 'border-red-400/25 bg-red-500/[0.08]',
    iconClass: 'text-red-300',
  },
};

function Signal({
  label,
  value,
  hint,
  positive,
}: {
  label: string;
  value: string;
  hint?: string;
  positive?: boolean | null;
}) {
  return (
    <div className="rounded-control border border-white/[0.08] bg-zinc-950/40 px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-sm font-medium',
          positive === true && 'text-emerald-300',
          positive === false && 'text-amber-200',
          positive == null && 'text-zinc-100',
        )}
        title={hint}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

interface WebsiteAnalysisPanelProps {
  hasWebsite: boolean;
  analysis?: LeadWebsiteAnalysis | null;
  errorMessage?: string | null;
}

/**
 * Painel amigável da análise de site — sem jargão de fila/API.
 */
export function WebsiteAnalysisPanel({
  hasWebsite,
  analysis,
  errorMessage,
}: WebsiteAnalysisPanelProps) {
  const tone = errorMessage ? 'fail' : resolveTone(analysis, hasWebsite);
  const banner = errorMessage
    ? {
        ...BANNER.fail,
        title: 'Não foi possível iniciar a verificação',
        body: 'Tente novamente em instantes. Se o problema continuar, confira se o endereço do site está correto.',
      }
    : !hasWebsite
      ? {
          ...BANNER.idle,
          title: 'Sem site cadastrado',
          body: 'A fonte não trouxe um site, ou ele ainda não foi informado. Isso não prova ausência — só falta de URL.',
        }
      : BANNER[tone];

  const Icon = banner.icon;
  const showSignals = analysis && (analysis.status === 'COMPLETED' || analysis.status === 'FAILED');

  return (
    <div className="space-y-4">
      <div
        className={cn('flex gap-3 rounded-panel border px-4 py-3.5', banner.shell)}
        role="status"
        aria-live="polite"
      >
        <div
          className={cn(
            'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/25',
            banner.iconClass,
          )}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-50">{banner.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{banner.body}</p>
        </div>
      </div>

      {showSignals ? (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <Signal
            label="Abre no navegador"
            value={analysis.httpStatus && analysis.httpStatus < 400 ? 'Sim' : 'Não ficou claro'}
            positive={Boolean(analysis.httpStatus && analysis.httpStatus < 400)}
          />
          <Signal
            label="Conexão segura"
            value={analysis.https === true ? 'Sim (HTTPS)' : analysis.https === false ? 'Não' : '—'}
            positive={analysis.https}
            hint={analysis.https === false ? 'Ideal migrar para HTTPS' : undefined}
          />
          <Signal
            label="Velocidade"
            value={speedLabel(analysis.responseTimeMs)}
            hint={
              analysis.responseTimeMs != null ? `${analysis.responseTimeMs} ms` : undefined
            }
            positive={
              analysis.responseTimeMs == null
                ? null
                : analysis.responseTimeMs < 1200
                  ? true
                  : false
            }
          />
          <Signal
            label="Bom no celular"
            value={
              analysis.hasViewport === true
                ? 'Sim'
                : analysis.hasViewport === false
                  ? 'Em dúvida'
                  : '—'
            }
            positive={analysis.hasViewport}
          />
          <Signal
            label="Formulário"
            value={
              analysis.hasContactForm === true
                ? 'Encontrado'
                : analysis.hasContactForm === false
                  ? 'Não vimos'
                  : '—'
            }
            positive={analysis.hasContactForm}
          />
          <Signal
            label="Título da página"
            value={analysis.title?.trim() || 'Não informado'}
            positive={analysis.title ? true : null}
          />
        </div>
      ) : null}
    </div>
  );
}
