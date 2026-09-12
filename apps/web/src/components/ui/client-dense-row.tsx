import { Mail, MessageCircle, MoreHorizontal, Phone } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { sanitizeMailtoHref, sanitizeTelHref } from '@/lib/safe-url';
import { cn } from '@/lib/utils';
import { getCompanyInitials } from '@/lib/company-initials';
import type { ContactChannel } from '@/lib/brazilian-phone';

export type ClientDenseRowMenuItem = {
  id: string;
  label: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
  disabled?: boolean;
};

export type ClientDenseRowTag = {
  id: string;
  label: string;
};

export type ClientDenseRowPrimaryAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function ClientDenseList({
  children,
  className,
  ...props
}: ComponentProps<'ul'>) {
  return (
    <ul className={cn('client-dense-list', className)} {...props}>
      {children}
    </ul>
  );
}

export function ClientDenseRow({
  name,
  subtitle,
  tags = [],
  status,
  extraBadges,
  email,
  phone,
  whatsappHref,
  channel,
  selected = false,
  selectable,
  onToggle,
  primaryAction,
  menuItems = [],
  onActivate,
}: {
  name: string;
  subtitle?: string | null;
  tags?: ClientDenseRowTag[];
  status?: ReactNode;
  extraBadges?: ReactNode;
  email?: string | null;
  phone?: string | null;
  whatsappHref?: string | null;
  channel: ContactChannel;
  selected?: boolean;
  selectable?: boolean;
  onToggle?: () => void;
  primaryAction?: ClientDenseRowPrimaryAction;
  menuItems?: ClientDenseRowMenuItem[];
  onActivate?: () => void;
}) {
  const { t } = useTranslation();
  const menuId = useId();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = getCompanyInitials(name);
  const emailHref = email ? sanitizeMailtoHref(email) : null;
  const telHref = phone ? sanitizeTelHref(phone) : null;
  const showCheckbox = typeof onToggle === 'function';
  const channelLabel =
    channel === 'whatsapp'
      ? t('clientRow.channelWhatsApp')
      : channel === 'email'
        ? t('clientRow.channelEmail')
        : channel === 'phone'
          ? t('clientRow.channelPhone')
          : t('clientRow.channelNone');

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  const stop = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <article
      className={cn(
        'client-dense-row',
        showCheckbox && 'client-dense-row--selectable',
        selected
          ? 'bg-[color:var(--brand-soft)]/40'
          : 'hover:bg-[color:var(--surface-hover)]',
        onActivate && 'cursor-pointer',
      )}
      onClick={onActivate}
    >
      {showCheckbox ? (
        <div
          className="client-dense-row__check"
          onClick={stop}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <input
            type="checkbox"
            aria-label={t('clientRow.select', { name })}
            checked={selected}
            disabled={selectable === false}
            onChange={() => onToggle?.()}
            className="h-4 w-4 rounded border-[color:var(--border-default)] text-[color:var(--brand)] focus:ring-[color:var(--ring)]"
          />
        </div>
      ) : null}

      <div className="client-dense-row__identity">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[color:var(--brand-soft)] text-xs font-bold text-[color:var(--brand-hover)]"
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-[color:var(--ink)]" title={name}>
            {name}
          </p>
          {subtitle ? (
            <p className="truncate text-xs text-[color:var(--ink-secondary)]">{subtitle}</p>
          ) : null}
          {tags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.slice(0, 3).map((tag) => (
                <Badge key={tag.id} className="font-normal">
                  {tag.label}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="client-dense-row__meta">
        <div className="client-dense-row__status" data-slot="status">
          {status}
          {extraBadges}
        </div>

        <div className="client-dense-row__phone" data-slot="phone">
          {phone ? (
            whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex max-w-full items-center gap-1.5 font-medium text-[color:var(--brand-hover)] hover:text-[color:var(--brand)]"
                onClick={stop}
                title={t('clientRow.openWhatsApp')}
              >
                <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{phone}</span>
              </a>
            ) : telHref ? (
              <a
                href={telHref}
                className="inline-flex max-w-full items-center gap-1.5 text-[color:var(--ink-secondary)] hover:text-[color:var(--ink)]"
                onClick={stop}
              >
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{phone}</span>
              </a>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1.5 text-[color:var(--ink-secondary)]">
                <Phone className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="truncate">{phone}</span>
              </span>
            )
          ) : (
            <span className="text-[color:var(--ink-muted)]">{t('common.dash')}</span>
          )}
        </div>

        <div className="client-dense-row__channel" data-slot="channel" title={email && channel === 'email' ? email : channelLabel}>
          {channel === 'email' && emailHref ? (
            <a
              href={emailHref}
              className="inline-flex max-w-full items-center gap-1.5 hover:text-[color:var(--brand)]"
              onClick={stop}
            >
              <Mail className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" aria-hidden />
              <span className="truncate">{channelLabel}</span>
            </a>
          ) : (
            <span className="inline-flex max-w-full items-center gap-1.5">
              {channel === 'whatsapp' ? (
                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand)]" aria-hidden />
              ) : channel === 'email' ? (
                <Mail className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" aria-hidden />
              ) : channel === 'phone' ? (
                <Phone className="h-3.5 w-3.5 shrink-0 text-[color:var(--ink-muted)]" aria-hidden />
              ) : null}
              <span className="truncate">{channelLabel}</span>
            </span>
          )}
        </div>
      </div>

      <div className="client-dense-row__actions">
        <div className="client-dense-row__cta" data-slot="cta" onClick={stop}>
          {primaryAction ? (
            <Button
              type="button"
              size="sm"
              className="w-full whitespace-nowrap"
              disabled={primaryAction.disabled}
              loading={primaryAction.loading}
              onClick={primaryAction.onClick}
            >
              {primaryAction.label}
            </Button>
          ) : (
            <span className="hidden lg:block" />
          )}
        </div>

        <div
          ref={menuRef}
          className="client-dense-row__menu"
          data-slot="menu"
          onClick={stop}
        >
          {menuItems.length ? (
            <>
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-control text-[color:var(--ink-secondary)] hover:bg-[color:var(--bg-subtle)] hover:text-[color:var(--ink)]"
                aria-label={t('clientRow.moreActions')}
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
              {menuOpen ? (
                <ul
                  id={menuId}
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-44 rounded-control border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] py-1 shadow-panel"
                >
                  {menuItems.map((item) => (
                    <li key={item.id} role="none">
                      {item.href && !item.disabled ? (
                        <a
                          role="menuitem"
                          href={item.href}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="block px-3 py-2 text-sm text-[color:var(--ink)] hover:bg-[color:var(--bg-subtle)]"
                          onClick={() => setMenuOpen(false)}
                        >
                          {item.label}
                        </a>
                      ) : (
                        <button
                          type="button"
                          role="menuitem"
                          disabled={item.disabled}
                          className={cn(
                            'block w-full px-3 py-2 text-left text-sm hover:bg-[color:var(--bg-subtle)] disabled:opacity-50',
                            item.danger
                              ? 'text-[color:var(--status-danger-ink)]'
                              : 'text-[color:var(--ink)]',
                          )}
                          onClick={() => {
                            setMenuOpen(false);
                            item.onClick?.();
                          }}
                        >
                          {item.label}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <span className="inline-block h-11 w-11" aria-hidden />
          )}
        </div>
      </div>
    </article>
  );
}
