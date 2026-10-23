import { useRef, type KeyboardEvent, type ReactNode } from 'react';
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
  role?: 'group' | 'tablist';
  className?: string;
}

/**
 * SegmentedControl — Controle segmentado em pílula (ex: Lista / Quadro / Mapa).
 * Suporta role="group" (padrão) com aria-pressed e role="tablist" com
 * aria-selected e navegação por setas (ArrowRight, ArrowLeft, Home, End).
 */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  role = 'group',
  className,
}: SegmentedControlProps<T>) {
  const isTablist = role === 'tablist';
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    if (!isTablist) return;

    const enabledIndices = options
      .map((opt, idx) => (!opt.disabled ? idx : null))
      .filter((idx): idx is number => idx !== null);

    if (enabledIndices.length === 0) return;

    const currentPos = enabledIndices.indexOf(currentIndex);
    let nextIndex: number | null = null;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      const nextPos = (currentPos + 1) % enabledIndices.length;
      nextIndex = enabledIndices[nextPos]!;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      const prevPos = (currentPos - 1 + enabledIndices.length) % enabledIndices.length;
      nextIndex = enabledIndices[prevPos]!;
    } else if (event.key === 'Home') {
      event.preventDefault();
      nextIndex = enabledIndices[0]!;
    } else if (event.key === 'End') {
      event.preventDefault();
      nextIndex = enabledIndices[enabledIndices.length - 1]!;
    }

    if (nextIndex !== null) {
      const targetOption = options[nextIndex];
      if (targetOption && !targetOption.disabled) {
        onChange(targetOption.value);
        buttonRefs.current[nextIndex]?.focus();
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
      {options.map((option, idx) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role={isTablist ? 'tab' : undefined}
            aria-selected={isTablist ? isSelected : undefined}
            aria-pressed={!isTablist ? isSelected : undefined}
            tabIndex={isTablist ? (isSelected ? 0 : -1) : 0}
            disabled={option.disabled}
            onKeyDown={(e) => handleKeyDown(e, idx)}
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
