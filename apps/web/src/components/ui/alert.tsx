import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const tones: Record<AlertTone, { className: string; icon: ComponentType<{ className?: string }> }> =
  {
    error: {
      className:
        'border-red-600/30 bg-red-50 text-red-950 dark:border-red-500/25 dark:bg-red-500/10 dark:text-red-200',
      icon: XCircle,
    },
    success: {
      className:
        'border-emerald-600/30 bg-emerald-50 text-emerald-950 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200',
      icon: CheckCircle2,
    },
    warning: {
      className:
        'border-amber-600/30 bg-amber-100 text-amber-950 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-200',
      icon: AlertTriangle,
    },
    info: {
      className:
        'border-zinc-300 bg-zinc-50 text-zinc-800 dark:border-white/10 dark:bg-white/[0.04] dark:text-zinc-200',
      icon: Info,
    },
  };

export interface AlertProps {
  tone?: AlertTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/**
 * Mensagem inline unificada. Substitui os blocos ad-hoc de erro/sucesso
 * espalhados pelas páginas, mantendo o mesmo papel semântico de cada tom.
 */
export function Alert({ tone = 'info', title, children, action, className }: AlertProps) {
  const { className: toneClass, icon: Icon } = tones[tone];
  const isLive = tone === 'error' || tone === 'warning';

  return (
    <div
      role={isLive ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-control border p-3.5 text-sm', toneClass, className)}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn(title && 'mt-0.5 opacity-90')}>{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
