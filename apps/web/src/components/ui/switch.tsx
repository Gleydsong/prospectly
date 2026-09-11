import { cn } from '@/lib/utils';

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  id?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  label,
  description,
  disabled,
  id,
}: SwitchProps) {
  const switchId = id ?? `switch-${label.replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={switchId} className="cursor-pointer text-sm font-semibold text-[color:var(--ink)]">
          {label}
        </label>
        {description ? (
          <p id={`${switchId}-description`} className="mt-0.5 text-sm leading-5 text-[color:var(--ink-muted)]">{description}</p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${switchId}-description` : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          checked ? 'bg-[color:var(--ink)]' : 'bg-zinc-600',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}
