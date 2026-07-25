import { X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

import { cn } from '@/lib/utils';

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-zinc-950/70"
        onClick={onClose}
        aria-label="Fechar"
        tabIndex={-1}
      />
      <div
        className={cn(
          'relative w-full max-w-lg rounded-control border border-zinc-800 bg-zinc-900 shadow-soft',
          'max-h-[90vh] overflow-y-auto',
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-50">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-control p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            aria-label="Fechar modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
