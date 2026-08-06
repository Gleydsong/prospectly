import { Link } from 'react-router-dom';

import { useEntitlements } from '../hooks';

export function PlanLimitsNotice() {
  const entitlements = useEntitlements();
  if (!entitlements.data) return null;

  const { usage, limits, plan, features } = entitlements.data;
  const draftsBlocked = usage.pageDrafts >= limits.pageDrafts;
  const publishBlocked = usage.publishedPages >= limits.publishedPages;

  if (!draftsBlocked && !publishBlocked) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-zinc-800 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-400">
        <p>
          Plano <span className="font-medium text-zinc-200">{plan}</span>
          {' · '}
          {usage.publishedPages}/{limits.publishedPages} publicadas
          {' · '}
          {usage.pageDrafts}/{limits.pageDrafts} rascunhos
          {!features.custom_domain ? ' · domínio próprio no Lifetime' : ''}
        </p>
        <Link to="/settings" className="min-h-11 inline-flex items-center text-brand-300 hover:underline">
          Ver planos
        </Link>
      </div>
    );
  }

  return (
    <div
      className="space-y-2 rounded-control border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
      role="status"
    >
      <p className="font-medium text-amber-50">Limite do plano {plan} atingido</p>
      <p className="text-amber-100/90">
        {draftsBlocked
          ? 'Você não pode criar novos rascunhos neste plano.'
          : 'Você não pode publicar mais páginas neste plano.'}{' '}
        Faça upgrade para continuar. A navegação e a edição de páginas existentes seguem disponíveis.
      </p>
      <Link to="/settings" className="inline-flex min-h-11 items-center font-medium text-brand-300 hover:underline">
        Ver planos e uso
      </Link>
    </div>
  );
}
