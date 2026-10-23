import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedControlOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: Array<SegmentedControlOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * SegmentedControl — Controle segmentado em pílula (ex: Lista / Quadro / Mapa).
 * Suporta acessibilidade via role="group" e aria-pressed nas opções.
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-1 text-sm select-none',
        className,
      )}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={isSelected}
            disabled={option.disabled}
            onClick={() => {
              if (!isSelected && !option.disabled) {
                onChange(option.value);
              }
            }}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-all duration-180',
              size === 'sm' ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-xs sm:text-sm',
              isSelected
                ? 'bg-[color:var(--bg-surface)] text-[color:var(--ink)] font-semibold shadow-soft'
                : 'text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)] hover:bg-black/[0.03] dark:hover:bg-white/[0.04]',
              option.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {option.icon ? <span className="shrink-0" aria-hidden="true">{option.icon}</span> : null}
            <span>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
