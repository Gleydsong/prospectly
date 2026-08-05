import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ComponentType, ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type AlertTone = 'error' | 'success' | 'warning' | 'info';

const tones: Record<AlertTone, { className: string; icon: ComponentType<{ className?: string }> }> =
  {
    error: { className: 'border-red-500/25 bg-red-500/10 text-red-200', icon: XCircle },
    success: { className: 'border-brand-500/25 bg-brand-500/10 text-brand-200', icon: CheckCircle2 },
    warning: {
      className: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
      icon: AlertTriangle,
    },
    info: { className: 'border-white/10 bg-white/[0.04] text-zinc-200', icon: Info },
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
