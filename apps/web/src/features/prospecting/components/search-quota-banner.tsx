import { Link } from 'react-router-dom';

import type { SearchUsage } from '@/features/billing/types';
import { cn } from '@/lib/utils';

const PLAN_LABEL: Record<string, string> = {
  FREE: 'Gratuito',
  STARTER_MONTHLY: 'Ilimitado',
  LIFETIME: 'Ilimitado',
};

export function planLabel(plan?: string): string {
  return plan ? (PLAN_LABEL[plan] ?? plan) : 'Gratuito';
}

export function SearchQuotaBanner({ usage, plan }: { usage?: SearchUsage; plan?: string }) {
  if (!usage) return null;

  if (usage.unlimited) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium text-zinc-200">Buscas ilimitadas</p>
        <p className="text-xs text-zinc-500">Plano {planLabel(plan)}</p>
      </div>
    );
  }

  const limit = usage.limit ?? 0;
  const percentage = limit > 0 ? Math.min(100, Math.round((usage.used / limit) * 100)) : 100;
  const depleted = usage.remaining === 0;

  return (
    <div className="w-full sm:w-64">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-zinc-200">
          {usage.used} / {limit} buscas
        </p>
        <span className="text-xs text-zinc-500">Plano {planLabel(plan)}</span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-zinc-800"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={usage.used}
        aria-label="Buscas usadas no plano atual"
      >
        <div
          className={cn('h-full rounded-full', depleted ? 'bg-red-500' : 'bg-brand-500')}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {depleted ? (
        <p className="mt-1.5 text-xs text-amber-300">
          Limite atingido.{' '}
          <Link to="/credits" className="underline hover:text-amber-200">
            Ver todos os planos
          </Link>
        </p>
      ) : null}
    </div>
  );
}
