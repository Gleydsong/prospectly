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
  role?: 'group' | 'tablist';
}

/**
 * SegmentedControl — Controle segmentado em pílula (ex: Lista / Quadro / Mapa).
 * Suporta acessibilidade via role="group" (padrão) com aria-pressed
 * ou role="tablist" com aria-selected e navegação por setas (ArrowLeft/ArrowRight, Home, End).
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
  role = 'group',
}: SegmentedControlProps<T>) {
  const isTablist = role === 'tablist';

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!isTablist) return;

    const enabledIndices = options
      .map((opt, idx) => (!opt.disabled ? idx : -1))
      .filter((idx) => idx !== -1);

    if (enabledIndices.length === 0) return;

    let targetIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const currentPos = enabledIndices.indexOf(currentIndex);
      const nextPos = (currentPos + 1) % enabledIndices.length;
      targetIndex = enabledIndices[nextPos] ?? null;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const currentPos = enabledIndices.indexOf(currentIndex);
      const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
      targetIndex = enabledIndices[prevPos] ?? null;
    } else if (event.key === 'Home') {
      event.preventDefault();
      targetIndex = enabledIndices[0] ?? null;
    } else if (event.key === 'End') {
      event.preventDefault();
      targetIndex = enabledIndices[enabledIndices.length - 1] ?? null;
    }

    if (targetIndex !== null && targetIndex !== undefined) {
      const targetOption = options[targetIndex];
      if (targetOption && !targetOption.disabled) {
        onChange(targetOption.value);
        const button = event.currentTarget.parentElement?.querySelectorAll('button')[targetIndex];
        button?.focus();
      }
    }
  };

  return (
    <div
      role={role}
      aria-label={ariaLabel}
      className={cn(
        'inline-flex items-center rounded-full border border-[color:var(--border-default)] bg-[color:var(--bg-subtle)] p-1 text-sm select-none',
        className,
      )}
    >
      {options.map((option, index) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role={isTablist ? 'tab' : undefined}
            aria-selected={isTablist ? isSelected : undefined}
            aria-pressed={!isTablist ? isSelected : undefined}
            tabIndex={isTablist ? (isSelected ? 0 : -1) : undefined}
            disabled={option.disabled}
            onKeyDown={(e) => handleKeyDown(e, index)}
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
