import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const tones: Record<AlertTone, { className: string; icon: ComponentType<{ className?: string }> }> =
  {
    error: {
      className:
        'border-[color:var(--status-danger-ink)]/25 bg-[color:var(--status-danger-bg)] text-[color:var(--ink)]',
      icon: XCircle,
    },
    success: {
      className:
        'border-[color:var(--status-success-ink)]/25 bg-[color:var(--status-success-bg)] text-[color:var(--ink)]',
      icon: CheckCircle2,
    },
    warning: {
      className:
        'border-[color:var(--status-warning-ink)]/25 bg-[color:var(--status-warning-bg)] text-[color:var(--ink)]',
      icon: AlertTriangle,
    },
    info: { className: 'border-[color:var(--border)] bg-[color:var(--surface-subtle)] text-[color:var(--ink)]', icon: Info },
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
